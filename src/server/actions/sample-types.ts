"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActor } from "@/server/services/auth-guard";
import { buildAuditData } from "@/server/services/audit";
import type { ActionResult } from "@/types/action";

const customFieldSchema = z.object({
  key: z
    .string()
    .min(1, "字段标识不能为空")
    .regex(
      /^[a-z][a-z0-9_]*$/,
      "字段标识只能包含小写字母、数字、下划线，且以字母开头",
    ),
  label: z.string().min(1, "字段名称不能为空"),
  type: z.enum(["text", "number", "date", "select", "boolean"]),
  required: z.boolean(),
  options: z.array(z.string().min(1)).optional(),
});

const sampleTypeInputSchema = z.object({
  name: z.string().min(1, "名称不能为空").max(50, "名称过长"),
  code: z
    .string()
    .min(1, "缩写不能为空")
    .max(20, "缩写过长")
    .regex(
      /^[A-Z][A-Z0-9_-]*$/,
      "缩写只能为大写字母、数字、下划线、连字符，以字母开头",
    ),
  icon: z.string().max(8, "图标过长").optional().or(z.literal("")),
  description: z.string().max(500, "描述过长").optional().or(z.literal("")),
  fields: z.array(customFieldSchema),
});

export type SampleTypeInput = z.infer<typeof sampleTypeInputSchema>;

function normalizeFields(input: SampleTypeInput) {
  return input.fields.map((f) => {
    const base = {
      key: f.key,
      label: f.label,
      type: f.type,
      required: f.required,
    };
    if (f.type === "select") {
      return { ...base, options: f.options ?? [] };
    }
    return base;
  });
}

function uniqueKeyCheck(fields: SampleTypeInput["fields"]): string | null {
  const seen = new Set<string>();
  for (const f of fields) {
    if (seen.has(f.key)) return `字段标识重复：${f.key}`;
    seen.add(f.key);
  }
  return null;
}

export async function createSampleTypeAction(
  input: SampleTypeInput,
): Promise<ActionResult<{ id: string }>> {
  const actor = await getActor();
  if (!actor) return { success: false, error: "未登录" };

  const parsed = sampleTypeInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "输入有误",
    };
  }

  const dupErr = uniqueKeyCheck(parsed.data.fields);
  if (dupErr) return { success: false, error: dupErr };

  const fields = normalizeFields(parsed.data);

  try {
    const created = await prisma.$transaction(async (tx) => {
      const created = await tx.sampleType.create({
        data: {
          name: parsed.data.name,
          code: parsed.data.code,
          icon: parsed.data.icon || null,
          description: parsed.data.description || null,
          customFieldsSchema: fields as unknown as Prisma.InputJsonValue,
        },
      });
      await tx.auditLog.create({
        data: buildAuditData({
          userId: actor.id,
          action: "CREATE_SAMPLE_TYPE",
          entityType: "SampleType",
          entityId: created.id,
          changes: { after: created },
        }),
      });
      return created;
    });

    revalidatePath("/sample-types");
    return { success: true, data: { id: created.id } };
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return { success: false, error: "名称或缩写已存在" };
    }
    return { success: false, error: "创建失败，请重试" };
  }
}

export async function updateSampleTypeAction(
  id: string,
  input: SampleTypeInput,
): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return { success: false, error: "未登录" };

  const parsed = sampleTypeInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "输入有误",
    };
  }

  const dupErr = uniqueKeyCheck(parsed.data.fields);
  if (dupErr) return { success: false, error: dupErr };

  const fields = normalizeFields(parsed.data);

  try {
    await prisma.$transaction(async (tx) => {
      const before = await tx.sampleType.findUnique({ where: { id } });
      if (!before) throw new Error("NOT_FOUND");

      const after = await tx.sampleType.update({
        where: { id },
        data: {
          name: parsed.data.name,
          code: parsed.data.code,
          icon: parsed.data.icon || null,
          description: parsed.data.description || null,
          customFieldsSchema: fields as unknown as Prisma.InputJsonValue,
        },
      });
      await tx.auditLog.create({
        data: buildAuditData({
          userId: actor.id,
          action: "UPDATE_SAMPLE_TYPE",
          entityType: "SampleType",
          entityId: id,
          changes: { before, after },
        }),
      });
    });

    revalidatePath("/sample-types");
    return { success: true };
  } catch (e) {
    if (e instanceof Error && e.message === "NOT_FOUND") {
      return { success: false, error: "样本类型不存在" };
    }
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return { success: false, error: "名称或缩写已存在" };
    }
    return { success: false, error: "更新失败，请重试" };
  }
}

export async function toggleSampleTypeActiveAction(
  id: string,
): Promise<ActionResult<{ isActive: boolean }>> {
  const actor = await getActor();
  if (!actor) return { success: false, error: "未登录" };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.sampleType.findUnique({ where: { id } });
      if (!before) throw new Error("NOT_FOUND");

      const after = await tx.sampleType.update({
        where: { id },
        data: { isActive: !before.isActive },
      });
      await tx.auditLog.create({
        data: buildAuditData({
          userId: actor.id,
          action: after.isActive ? "ENABLE_SAMPLE_TYPE" : "DISABLE_SAMPLE_TYPE",
          entityType: "SampleType",
          entityId: id,
          changes: {
            before: { isActive: before.isActive },
            after: { isActive: after.isActive },
          },
        }),
      });
      return after;
    });

    revalidatePath("/sample-types");
    return { success: true, data: { isActive: result.isActive } };
  } catch (e) {
    if (e instanceof Error && e.message === "NOT_FOUND") {
      return { success: false, error: "样本类型不存在" };
    }
    return { success: false, error: "状态切换失败，请重试" };
  }
}
