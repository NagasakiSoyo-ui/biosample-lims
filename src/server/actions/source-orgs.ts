"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActor } from "@/server/services/auth-guard";
import { buildAuditData } from "@/server/services/audit";
import type { ActionResult } from "@/types/action";

const sourceOrgInputSchema = z.object({
  name: z.string().min(1, "名称不能为空").max(100, "名称过长"),
  type: z.string().max(50, "类型过长").optional().or(z.literal("")),
  contactPerson: z.string().max(50, "联系人过长").optional().or(z.literal("")),
  contactPhone: z.string().max(50, "电话过长").optional().or(z.literal("")),
  address: z.string().max(200, "地址过长").optional().or(z.literal("")),
  notes: z.string().max(500, "备注过长").optional().or(z.literal("")),
});

export type SourceOrgInput = z.infer<typeof sourceOrgInputSchema>;

function clean(input: SourceOrgInput) {
  return {
    name: input.name,
    type: input.type || null,
    contactPerson: input.contactPerson || null,
    contactPhone: input.contactPhone || null,
    address: input.address || null,
    notes: input.notes || null,
  };
}

export async function createSourceOrgAction(
  input: SourceOrgInput,
): Promise<ActionResult<{ id: string }>> {
  const actor = await getActor();
  if (!actor) return { success: false, error: "未登录" };

  const parsed = sourceOrgInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "输入有误",
    };
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const created = await tx.sourceOrg.create({ data: clean(parsed.data) });
      await tx.auditLog.create({
        data: buildAuditData({
          userId: actor.id,
          action: "CREATE_SOURCE_ORG",
          entityType: "SourceOrg",
          entityId: created.id,
          changes: { after: created },
        }),
      });
      return created;
    });
    revalidatePath("/source-orgs");
    return { success: true, data: { id: created.id } };
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return { success: false, error: "名称已存在" };
    }
    return { success: false, error: "创建失败，请重试" };
  }
}

export async function updateSourceOrgAction(
  id: string,
  input: SourceOrgInput,
): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return { success: false, error: "未登录" };

  const parsed = sourceOrgInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "输入有误",
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const before = await tx.sourceOrg.findUnique({ where: { id } });
      if (!before) throw new Error("NOT_FOUND");
      const after = await tx.sourceOrg.update({
        where: { id },
        data: clean(parsed.data),
      });
      await tx.auditLog.create({
        data: buildAuditData({
          userId: actor.id,
          action: "UPDATE_SOURCE_ORG",
          entityType: "SourceOrg",
          entityId: id,
          changes: { before, after },
        }),
      });
    });
    revalidatePath("/source-orgs");
    return { success: true };
  } catch (e) {
    if (e instanceof Error && e.message === "NOT_FOUND") {
      return { success: false, error: "来源单位不存在" };
    }
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return { success: false, error: "名称已存在" };
    }
    return { success: false, error: "更新失败，请重试" };
  }
}

export async function toggleSourceOrgActiveAction(
  id: string,
): Promise<ActionResult<{ isActive: boolean }>> {
  const actor = await getActor();
  if (!actor) return { success: false, error: "未登录" };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.sourceOrg.findUnique({ where: { id } });
      if (!before) throw new Error("NOT_FOUND");
      const after = await tx.sourceOrg.update({
        where: { id },
        data: { isActive: !before.isActive },
      });
      await tx.auditLog.create({
        data: buildAuditData({
          userId: actor.id,
          action: after.isActive ? "ENABLE_SOURCE_ORG" : "DISABLE_SOURCE_ORG",
          entityType: "SourceOrg",
          entityId: id,
          changes: {
            before: { isActive: before.isActive },
            after: { isActive: after.isActive },
          },
        }),
      });
      return after;
    });
    revalidatePath("/source-orgs");
    return { success: true, data: { isActive: result.isActive } };
  } catch (e) {
    if (e instanceof Error && e.message === "NOT_FOUND") {
      return { success: false, error: "来源单位不存在" };
    }
    return { success: false, error: "状态切换失败，请重试" };
  }
}
