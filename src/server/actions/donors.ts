"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActor } from "@/server/services/auth-guard";
import { buildAuditData } from "@/server/services/audit";
import type { ActionResult } from "@/types/action";

const donorInputSchema = z.object({
  code: z.string().min(1, "脱敏 ID 不能为空").max(50, "脱敏 ID 过长"),
  gender: z.enum(["M", "F", "Unknown"]).optional().or(z.literal("")),
  ageAtCollection: z
    .union([z.number().int().min(0).max(200), z.null()])
    .optional(),
  diagnosis: z.string().max(200, "诊断过长").optional().or(z.literal("")),
  collectionDate: z.string().optional().or(z.literal("")),
  sourceOrgId: z.string().optional().or(z.literal("")),
  projectId: z.string().optional().or(z.literal("")),
  notes: z.string().max(500, "备注过长").optional().or(z.literal("")),
});

export type DonorInput = z.infer<typeof donorInputSchema>;

function clean(input: DonorInput) {
  const collectionDate = input.collectionDate
    ? new Date(input.collectionDate)
    : null;
  if (collectionDate && isNaN(collectionDate.getTime())) {
    throw new Error("INVALID_DATE");
  }
  return {
    code: input.code,
    gender: input.gender || null,
    ageAtCollection:
      typeof input.ageAtCollection === "number"
        ? input.ageAtCollection
        : null,
    diagnosis: input.diagnosis || null,
    collectionDate,
    sourceOrgId: input.sourceOrgId || null,
    projectId: input.projectId || null,
    notes: input.notes || null,
  };
}

export async function createDonorAction(
  input: DonorInput,
): Promise<ActionResult<{ id: string }>> {
  const actor = await getActor();
  if (!actor) return { success: false, error: "未登录" };

  const parsed = donorInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "输入有误",
    };
  }

  let cleaned;
  try {
    cleaned = clean(parsed.data);
  } catch {
    return { success: false, error: "采集日期格式不正确" };
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const created = await tx.donor.create({ data: cleaned });
      await tx.auditLog.create({
        data: buildAuditData({
          userId: actor.id,
          action: "CREATE_DONOR",
          entityType: "Donor",
          entityId: created.id,
          changes: { after: created },
        }),
      });
      return created;
    });
    revalidatePath("/donors");
    return { success: true, data: { id: created.id } };
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return { success: false, error: "脱敏 ID 已存在" };
    }
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2003"
    ) {
      return { success: false, error: "所选的项目或来源单位无效" };
    }
    return { success: false, error: "创建失败，请重试" };
  }
}

export async function updateDonorAction(
  id: string,
  input: DonorInput,
): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return { success: false, error: "未登录" };

  const parsed = donorInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "输入有误",
    };
  }

  let cleaned;
  try {
    cleaned = clean(parsed.data);
  } catch {
    return { success: false, error: "采集日期格式不正确" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const before = await tx.donor.findUnique({ where: { id } });
      if (!before) throw new Error("NOT_FOUND");
      const after = await tx.donor.update({ where: { id }, data: cleaned });
      await tx.auditLog.create({
        data: buildAuditData({
          userId: actor.id,
          action: "UPDATE_DONOR",
          entityType: "Donor",
          entityId: id,
          changes: { before, after },
        }),
      });
    });
    revalidatePath("/donors");
    return { success: true };
  } catch (e) {
    if (e instanceof Error && e.message === "NOT_FOUND") {
      return { success: false, error: "供者不存在" };
    }
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return { success: false, error: "脱敏 ID 已存在" };
    }
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2003"
    ) {
      return { success: false, error: "所选的项目或来源单位无效" };
    }
    return { success: false, error: "更新失败，请重试" };
  }
}

export async function toggleDonorActiveAction(
  id: string,
): Promise<ActionResult<{ isActive: boolean }>> {
  const actor = await getActor();
  if (!actor) return { success: false, error: "未登录" };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.donor.findUnique({ where: { id } });
      if (!before) throw new Error("NOT_FOUND");
      const after = await tx.donor.update({
        where: { id },
        data: { isActive: !before.isActive },
      });
      await tx.auditLog.create({
        data: buildAuditData({
          userId: actor.id,
          action: after.isActive ? "ENABLE_DONOR" : "DISABLE_DONOR",
          entityType: "Donor",
          entityId: id,
          changes: {
            before: { isActive: before.isActive },
            after: { isActive: after.isActive },
          },
        }),
      });
      return after;
    });
    revalidatePath("/donors");
    return { success: true, data: { isActive: result.isActive } };
  } catch (e) {
    if (e instanceof Error && e.message === "NOT_FOUND") {
      return { success: false, error: "供者不存在" };
    }
    return { success: false, error: "状态切换失败，请重试" };
  }
}
