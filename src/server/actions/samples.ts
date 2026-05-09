"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActor } from "@/server/services/auth-guard";
import { buildAuditData } from "@/server/services/audit";
import { isSlotOccupied } from "@/server/services/locations";
import {
  generateSampleCode,
  parseCustomFieldsSchema,
  validateCustomFields,
  coerceCustomFields,
} from "@/server/services/samples";
import type { ActionResult } from "@/types/action";

// ---------------------------------------------------------------------------
// Shared validators
// ---------------------------------------------------------------------------

const dateString = z
  .string()
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

const sampleCoreSchema = z.object({
  projectId: z.string().min(1, "项目不能为空"),
  typeId: z.string().min(1, "样本类型不能为空"),
  purpose: z.enum(["RESEARCH", "CLINICAL_INFUSION"]),
  sourceOrgId: z.string().optional().or(z.literal("")),
  donorId: z.string().optional().or(z.literal("")),
  parentSampleId: z.string().optional().or(z.literal("")),
  locationId: z.string().optional().or(z.literal("")),
  volume: z
    .union([z.number(), z.null()])
    .optional()
    .nullable(),
  volumeUnit: z.string().optional().or(z.literal("")),
  collectedAt: dateString,
  frozenAt: dateString,
  expireAt: dateString,
  customFields: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().max(2000, "备注过长").optional().or(z.literal("")),
});

const createInputSchema = sampleCoreSchema.extend({
  sampleCode: z.string().min(1, "样本编号不能为空").max(80, "样本编号过长"),
});

export type CreateSampleInput = z.infer<typeof createInputSchema>;

const updateInputSchema = sampleCoreSchema; // sampleCode + parentSampleId are immutable
export type UpdateSampleInput = z.infer<typeof updateInputSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDateOrNull(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

async function loadTypeSchema(
  client: Prisma.TransactionClient,
  typeId: string,
) {
  const t = await client.sampleType.findUnique({
    where: { id: typeId },
    select: { customFieldsSchema: true, isActive: true },
  });
  if (!t) return null;
  return {
    isActive: t.isActive,
    schema: parseCustomFieldsSchema(t.customFieldsSchema),
  };
}

// ---------------------------------------------------------------------------
// generateSampleCodeAction — preview button on the create form
// ---------------------------------------------------------------------------

export async function generateSampleCodeAction(
  projectId: string,
  typeId: string,
): Promise<ActionResult<{ sampleCode: string }>> {
  const actor = await getActor();
  if (!actor) return { success: false, error: "未登录" };

  if (!projectId || !typeId) {
    return { success: false, error: "请先选择项目和样本类型" };
  }

  const code = await prisma.$transaction(async (tx) =>
    generateSampleCode(tx, { projectId, typeId }),
  );
  if (!code) return { success: false, error: "项目或样本类型不存在" };
  return { success: true, data: { sampleCode: code } };
}

// ---------------------------------------------------------------------------
// createSampleAction
// ---------------------------------------------------------------------------

export async function createSampleAction(
  input: CreateSampleInput,
): Promise<ActionResult<{ id: string }>> {
  const actor = await getActor();
  if (!actor) return { success: false, error: "未登录" };

  const parsed = createInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "输入有误",
    };
  }
  const data = parsed.data;

  try {
    const created = await prisma.$transaction(async (tx) => {
      const typeInfo = await loadTypeSchema(tx, data.typeId);
      if (!typeInfo) throw new Error("TYPE_NOT_FOUND");
      if (!typeInfo.isActive) throw new Error("TYPE_DISABLED");

      const customFieldErr = validateCustomFields(
        typeInfo.schema,
        data.customFields ?? {},
      );
      if (customFieldErr) throw new Error(`CUSTOM:${customFieldErr}`);

      // Location check
      const locationId = data.locationId || null;
      if (locationId) {
        const occupied = await isSlotOccupied(tx, locationId);
        if (occupied) throw new Error("SLOT_OCCUPIED");
      }

      // sampleCode uniqueness within project — Prisma's unique covers it,
      // but a friendlier explicit check first.
      const dup = await tx.sample.findFirst({
        where: { projectId: data.projectId, sampleCode: data.sampleCode },
      });
      if (dup) throw new Error("CODE_DUP");

      const created = await tx.sample.create({
        data: {
          sampleCode: data.sampleCode,
          typeId: data.typeId,
          projectId: data.projectId,
          sourceOrgId: data.sourceOrgId || null,
          donorId: data.donorId || null,
          parentSampleId: data.parentSampleId || null,
          locationId,
          purpose: data.purpose,
          status: "AVAILABLE",
          volume:
            typeof data.volume === "number" && !isNaN(data.volume)
              ? data.volume
              : null,
          volumeUnit: data.volumeUnit || null,
          collectedAt: toDateOrNull(data.collectedAt),
          frozenAt: toDateOrNull(data.frozenAt),
          expireAt: toDateOrNull(data.expireAt),
          freezeThawCount: 0,
          customFields: coerceCustomFields(
            typeInfo.schema,
            data.customFields ?? {},
          ) as unknown as Prisma.InputJsonValue,
          notes: data.notes || null,
          createdById: actor.id,
        },
      });

      // INBOUND transaction (only if a location was assigned)
      if (locationId) {
        await tx.sampleTransaction.create({
          data: {
            sampleId: created.id,
            type: "INBOUND",
            toLocationId: locationId,
            newStatus: "AVAILABLE",
            operatorId: actor.id,
            reason: "新样本登记入库",
          },
        });
      }

      await tx.auditLog.create({
        data: buildAuditData({
          userId: actor.id,
          action: "CREATE_SAMPLE",
          entityType: "Sample",
          entityId: created.id,
          changes: { after: created },
        }),
      });

      return created;
    });

    revalidatePath("/samples");
    return { success: true, data: { id: created.id } };
  } catch (e) {
    return mapCreateError(e);
  }
}

function mapCreateError(e: unknown): { success: false; error: string } {
  if (e instanceof Error) {
    if (e.message === "TYPE_NOT_FOUND")
      return { success: false, error: "样本类型不存在" };
    if (e.message === "TYPE_DISABLED")
      return { success: false, error: "样本类型已禁用" };
    if (e.message === "CODE_DUP")
      return { success: false, error: "样本编号在该项目下已存在" };
    if (e.message === "SLOT_OCCUPIED")
      return { success: false, error: "该位置已被其他样本占用" };
    if (e.message.startsWith("CUSTOM:"))
      return { success: false, error: e.message.slice(7) };
  }
  if (
    e instanceof Prisma.PrismaClientKnownRequestError &&
    e.code === "P2002"
  ) {
    return { success: false, error: "样本编号在该项目下已存在" };
  }
  if (
    e instanceof Prisma.PrismaClientKnownRequestError &&
    e.code === "P2003"
  ) {
    return { success: false, error: "项目 / 类型 / 供者 / 位置 关联无效" };
  }
  return { success: false, error: "保存失败，请重试" };
}

// ---------------------------------------------------------------------------
// updateSampleAction
// ---------------------------------------------------------------------------

export async function updateSampleAction(
  id: string,
  input: UpdateSampleInput,
): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return { success: false, error: "未登录" };

  const parsed = updateInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "输入有误",
    };
  }
  const data = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const before = await tx.sample.findUnique({ where: { id } });
      if (!before) throw new Error("NOT_FOUND");

      const typeInfo = await loadTypeSchema(tx, data.typeId);
      if (!typeInfo) throw new Error("TYPE_NOT_FOUND");

      const customFieldErr = validateCustomFields(
        typeInfo.schema,
        data.customFields ?? {},
      );
      if (customFieldErr) throw new Error(`CUSTOM:${customFieldErr}`);

      // Location change check
      const newLoc = data.locationId || null;
      if (newLoc && newLoc !== before.locationId) {
        const occupied = await isSlotOccupied(tx, newLoc, id);
        if (occupied) throw new Error("SLOT_OCCUPIED");
      }

      const after = await tx.sample.update({
        where: { id },
        data: {
          typeId: data.typeId,
          projectId: data.projectId,
          sourceOrgId: data.sourceOrgId || null,
          donorId: data.donorId || null,
          locationId: newLoc,
          purpose: data.purpose,
          volume:
            typeof data.volume === "number" && !isNaN(data.volume)
              ? data.volume
              : null,
          volumeUnit: data.volumeUnit || null,
          collectedAt: toDateOrNull(data.collectedAt),
          frozenAt: toDateOrNull(data.frozenAt),
          expireAt: toDateOrNull(data.expireAt),
          customFields: coerceCustomFields(
            typeInfo.schema,
            data.customFields ?? {},
          ) as unknown as Prisma.InputJsonValue,
          notes: data.notes || null,
        },
      });

      // If location changed, write a MOVE transaction.
      if (before.locationId !== newLoc) {
        await tx.sampleTransaction.create({
          data: {
            sampleId: id,
            type: "MOVE",
            fromLocationId: before.locationId,
            toLocationId: newLoc,
            operatorId: actor.id,
            reason: "编辑样本：位置变更",
          },
        });
      }

      await tx.auditLog.create({
        data: buildAuditData({
          userId: actor.id,
          action: "UPDATE_SAMPLE",
          entityType: "Sample",
          entityId: id,
          changes: { before, after },
        }),
      });
    });

    revalidatePath("/samples");
    revalidatePath(`/samples/${id}`);
    return { success: true };
  } catch (e) {
    return mapCreateError(e);
  }
}

// ---------------------------------------------------------------------------
// batchCreateSamplesAction — split a parent sample into N aliquots
// ---------------------------------------------------------------------------

const batchInputSchema = z.object({
  parentSampleId: z.string().min(1, "请选择母样本"),
  count: z.number().int().min(1).max(100, "数量必须在 1 到 100 之间"),
  suffixStrategy: z.enum(["LETTER", "NUMBER"]),
  numberStart: z.number().int().min(1).optional(),
  slotIds: z.array(z.string().min(1)),
  shared: sampleCoreSchema.partial().extend({
    projectId: z.string().min(1),
    typeId: z.string().min(1),
    purpose: z.enum(["RESEARCH", "CLINICAL_INFUSION"]),
  }),
});

export type BatchCreateInput = z.infer<typeof batchInputSchema>;

function buildSuffixes(strategy: "LETTER" | "NUMBER", count: number, start = 1): string[] {
  if (strategy === "LETTER") {
    if (count > 26) throw new Error("LETTER 策略最多支持 26 个");
    return Array.from({ length: count }, (_, i) =>
      String.fromCharCode(65 + i),
    );
  }
  return Array.from({ length: count }, (_, i) =>
    String(start + i).padStart(2, "0"),
  );
}

export async function batchCreateSamplesAction(
  input: BatchCreateInput,
): Promise<ActionResult<{ count: number; firstId: string }>> {
  const actor = await getActor();
  if (!actor) return { success: false, error: "未登录" };

  const parsed = batchInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "输入有误",
    };
  }
  const data = parsed.data;

  if (data.slotIds.length !== data.count) {
    return {
      success: false,
      error: `已选 ${data.slotIds.length} 个位置，与子样本数量 ${data.count} 不一致`,
    };
  }

  let suffixes: string[];
  try {
    suffixes = buildSuffixes(
      data.suffixStrategy,
      data.count,
      data.numberStart ?? 1,
    );
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "后缀生成失败",
    };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const parent = await tx.sample.findUnique({
        where: { id: data.parentSampleId },
      });
      if (!parent) throw new Error("PARENT_NOT_FOUND");

      const typeInfo = await loadTypeSchema(tx, data.shared.typeId);
      if (!typeInfo) throw new Error("TYPE_NOT_FOUND");

      // Pre-flight: every slot must be unoccupied.
      for (const sid of data.slotIds) {
        const occ = await isSlotOccupied(tx, sid);
        if (occ) throw new Error(`SLOT_OCCUPIED:${sid}`);
      }

      const sharedCustomFields = coerceCustomFields(
        typeInfo.schema,
        (data.shared.customFields as Record<string, unknown>) ?? {},
      );

      const createdIds: string[] = [];
      let firstId = "";

      for (let i = 0; i < data.count; i++) {
        const childCode = `${parent.sampleCode}-${suffixes[i]}`;
        const slot = data.slotIds[i];

        const created = await tx.sample.create({
          data: {
            sampleCode: childCode,
            typeId: data.shared.typeId,
            projectId: data.shared.projectId,
            sourceOrgId: parent.sourceOrgId,
            donorId: parent.donorId,
            parentSampleId: parent.id,
            locationId: slot,
            purpose: data.shared.purpose,
            status: "AVAILABLE",
            volume:
              typeof data.shared.volume === "number" &&
              !isNaN(data.shared.volume)
                ? data.shared.volume
                : null,
            volumeUnit: data.shared.volumeUnit || null,
            collectedAt: toDateOrNull(
              data.shared.collectedAt ?? null,
            ),
            frozenAt: toDateOrNull(data.shared.frozenAt ?? null),
            expireAt: toDateOrNull(data.shared.expireAt ?? null),
            freezeThawCount: 0,
            customFields: sharedCustomFields as unknown as Prisma.InputJsonValue,
            notes: data.shared.notes || null,
            createdById: actor.id,
          },
        });
        if (i === 0) firstId = created.id;
        createdIds.push(created.id);

        await tx.sampleTransaction.create({
          data: {
            sampleId: created.id,
            type: "INBOUND",
            toLocationId: slot,
            newStatus: "AVAILABLE",
            operatorId: actor.id,
            reason: "批量分装入库",
          },
        });
      }

      await tx.auditLog.create({
        data: buildAuditData({
          userId: actor.id,
          action: "BATCH_CREATE_SAMPLES",
          entityType: "Sample",
          entityId: parent.id,
          changes: {
            after: {
              parentSampleId: parent.id,
              parentSampleCode: parent.sampleCode,
              count: data.count,
              createdIds,
            },
          },
        }),
      });

      return { count: data.count, firstId };
    });

    revalidatePath("/samples");
    return { success: true, data: result };
  } catch (e) {
    if (e instanceof Error) {
      if (e.message === "PARENT_NOT_FOUND")
        return { success: false, error: "母样本不存在" };
      if (e.message === "TYPE_NOT_FOUND")
        return { success: false, error: "样本类型不存在" };
      if (e.message.startsWith("SLOT_OCCUPIED:"))
        return { success: false, error: "其中一个位置已被占用，请重新选择" };
    }
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return {
        success: false,
        error: "生成的子样本编号与已有样本冲突，请调整后缀策略",
      };
    }
    return { success: false, error: "批量创建失败，请重试" };
  }
}

// ---------------------------------------------------------------------------
// outboundSampleAction
// ---------------------------------------------------------------------------

const outboundInputSchema = z.object({
  reason: z.string().min(1, "请选择或填写出库原因"),
  quantityChange: z.number().nullable().optional(),
  newStatus: z.enum(["IN_USE", "DEPLETED", "RELEASED"]),
  operatorNote: z.string().optional().or(z.literal("")),
});

export type OutboundInput = z.infer<typeof outboundInputSchema>;

export async function outboundSampleAction(
  id: string,
  input: OutboundInput,
): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return { success: false, error: "未登录" };

  const parsed = outboundInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "输入有误",
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const before = await tx.sample.findUnique({ where: { id } });
      if (!before) throw new Error("NOT_FOUND");

      const releasingLocation =
        parsed.data.newStatus === "DEPLETED" ||
        parsed.data.newStatus === "RELEASED";

      const after = await tx.sample.update({
        where: { id },
        data: {
          status: parsed.data.newStatus,
          locationId: releasingLocation ? null : before.locationId,
          volume:
            before.volume != null && parsed.data.quantityChange
              ? Math.max(0, before.volume - parsed.data.quantityChange)
              : before.volume,
        },
      });

      await tx.sampleTransaction.create({
        data: {
          sampleId: id,
          type: "OUTBOUND",
          fromLocationId: before.locationId,
          toLocationId: null,
          quantityChange: parsed.data.quantityChange ?? null,
          previousStatus: before.status,
          newStatus: parsed.data.newStatus,
          reason: parsed.data.reason,
          operatorId: actor.id,
          operatorNote: parsed.data.operatorNote || null,
        },
      });

      await tx.auditLog.create({
        data: buildAuditData({
          userId: actor.id,
          action: "OUTBOUND_SAMPLE",
          entityType: "Sample",
          entityId: id,
          changes: { before, after },
        }),
      });
    });

    revalidatePath("/samples");
    revalidatePath(`/samples/${id}`);
    return { success: true };
  } catch (e) {
    if (e instanceof Error && e.message === "NOT_FOUND") {
      return { success: false, error: "样本不存在" };
    }
    return { success: false, error: "出库失败，请重试" };
  }
}

// ---------------------------------------------------------------------------
// transferSampleAction (location move)
// ---------------------------------------------------------------------------

const transferInputSchema = z.object({
  toLocationId: z.string().min(1, "请选择目标位置"),
  operatorNote: z.string().optional().or(z.literal("")),
});

export type TransferInput = z.infer<typeof transferInputSchema>;

export async function transferSampleAction(
  id: string,
  input: TransferInput,
): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return { success: false, error: "未登录" };

  const parsed = transferInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "输入有误",
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const before = await tx.sample.findUnique({ where: { id } });
      if (!before) throw new Error("NOT_FOUND");

      if (before.locationId === parsed.data.toLocationId) {
        throw new Error("SAME_LOCATION");
      }
      const occupied = await isSlotOccupied(tx, parsed.data.toLocationId, id);
      if (occupied) throw new Error("SLOT_OCCUPIED");

      const after = await tx.sample.update({
        where: { id },
        data: { locationId: parsed.data.toLocationId },
      });

      await tx.sampleTransaction.create({
        data: {
          sampleId: id,
          type: "MOVE",
          fromLocationId: before.locationId,
          toLocationId: parsed.data.toLocationId,
          operatorId: actor.id,
          operatorNote: parsed.data.operatorNote || null,
          reason: "位置转移",
        },
      });

      await tx.auditLog.create({
        data: buildAuditData({
          userId: actor.id,
          action: "TRANSFER_SAMPLE",
          entityType: "Sample",
          entityId: id,
          changes: {
            before: { locationId: before.locationId },
            after: { locationId: after.locationId },
          },
        }),
      });
    });

    revalidatePath("/samples");
    revalidatePath(`/samples/${id}`);
    return { success: true };
  } catch (e) {
    if (e instanceof Error) {
      if (e.message === "NOT_FOUND")
        return { success: false, error: "样本不存在" };
      if (e.message === "SAME_LOCATION")
        return { success: false, error: "目标位置与当前位置相同" };
      if (e.message === "SLOT_OCCUPIED")
        return { success: false, error: "目标位置已被占用" };
    }
    return { success: false, error: "转移失败，请重试" };
  }
}

// ---------------------------------------------------------------------------
// freezeThawSampleAction
// ---------------------------------------------------------------------------

const freezeThawInputSchema = z.object({
  operatorNote: z.string().optional().or(z.literal("")),
});

export type FreezeThawInput = z.infer<typeof freezeThawInputSchema>;

export async function freezeThawSampleAction(
  id: string,
  input: FreezeThawInput,
): Promise<ActionResult<{ newCount: number }>> {
  const actor = await getActor();
  if (!actor) return { success: false, error: "未登录" };

  const parsed = freezeThawInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "输入有误",
    };
  }

  try {
    const newCount = await prisma.$transaction(async (tx) => {
      const before = await tx.sample.findUnique({ where: { id } });
      if (!before) throw new Error("NOT_FOUND");

      const after = await tx.sample.update({
        where: { id },
        data: { freezeThawCount: before.freezeThawCount + 1 },
      });

      await tx.sampleTransaction.create({
        data: {
          sampleId: id,
          type: "FREEZE_THAW",
          fromLocationId: before.locationId,
          toLocationId: before.locationId,
          operatorId: actor.id,
          operatorNote: parsed.data.operatorNote || null,
          reason: "冻融操作",
        },
      });

      await tx.auditLog.create({
        data: buildAuditData({
          userId: actor.id,
          action: "FREEZE_THAW_SAMPLE",
          entityType: "Sample",
          entityId: id,
          changes: {
            before: { freezeThawCount: before.freezeThawCount },
            after: { freezeThawCount: after.freezeThawCount },
          },
        }),
      });

      return after.freezeThawCount;
    });

    revalidatePath("/samples");
    revalidatePath(`/samples/${id}`);
    return { success: true, data: { newCount } };
  } catch (e) {
    if (e instanceof Error && e.message === "NOT_FOUND") {
      return { success: false, error: "样本不存在" };
    }
    return { success: false, error: "冻融记录失败，请重试" };
  }
}

// ---------------------------------------------------------------------------
// discardSampleAction
// ---------------------------------------------------------------------------

const discardInputSchema = z.object({
  reason: z.string().min(1, "请填写销毁原因"),
});

export type DiscardInput = z.infer<typeof discardInputSchema>;

export async function discardSampleAction(
  id: string,
  input: DiscardInput,
): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return { success: false, error: "未登录" };

  const parsed = discardInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "输入有误",
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const before = await tx.sample.findUnique({ where: { id } });
      if (!before) throw new Error("NOT_FOUND");

      const after = await tx.sample.update({
        where: { id },
        data: { status: "DISCARDED", locationId: null },
      });

      await tx.sampleTransaction.create({
        data: {
          sampleId: id,
          type: "DISCARD",
          fromLocationId: before.locationId,
          toLocationId: null,
          previousStatus: before.status,
          newStatus: "DISCARDED",
          reason: parsed.data.reason,
          operatorId: actor.id,
        },
      });

      await tx.auditLog.create({
        data: buildAuditData({
          userId: actor.id,
          action: "DISCARD_SAMPLE",
          entityType: "Sample",
          entityId: id,
          changes: { before, after },
        }),
      });
    });

    revalidatePath("/samples");
    revalidatePath(`/samples/${id}`);
    return { success: true };
  } catch (e) {
    if (e instanceof Error && e.message === "NOT_FOUND") {
      return { success: false, error: "样本不存在" };
    }
    return { success: false, error: "销毁失败，请重试" };
  }
}

// Note: VOLUME_UNITS is intentionally NOT exported from this file. Files with
// "use server" may only export async functions. The constant lives in
// @/server/services/samples instead.
