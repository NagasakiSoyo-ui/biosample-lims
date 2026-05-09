"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActor } from "@/server/services/auth-guard";
import { buildAuditData } from "@/server/services/audit";
import type { ActionResult } from "@/types/action";

const projectInputSchema = z.object({
  name: z.string().min(1, "名称不能为空").max(100, "名称过长"),
  code: z
    .string()
    .min(1, "缩写不能为空")
    .max(20, "缩写过长")
    .regex(
      /^[A-Z][A-Z0-9_-]*$/,
      "缩写只能为大写字母、数字、下划线、连字符，以字母开头",
    ),
  purpose: z.enum(["RESEARCH", "CLINICAL_INFUSION"]),
  description: z.string().max(500, "描述过长").optional().or(z.literal("")),
});

export type ProjectInput = z.infer<typeof projectInputSchema>;

export async function createProjectAction(
  input: ProjectInput,
): Promise<ActionResult<{ id: string }>> {
  const actor = await getActor();
  if (!actor) return { success: false, error: "未登录" };

  const parsed = projectInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "输入有误",
    };
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          name: parsed.data.name,
          code: parsed.data.code,
          purpose: parsed.data.purpose,
          description: parsed.data.description || null,
        },
      });
      await tx.auditLog.create({
        data: buildAuditData({
          userId: actor.id,
          action: "CREATE_PROJECT",
          entityType: "Project",
          entityId: created.id,
          changes: { after: created },
        }),
      });
      return created;
    });

    revalidatePath("/projects");
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

export async function updateProjectAction(
  id: string,
  input: ProjectInput,
): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return { success: false, error: "未登录" };

  const parsed = projectInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "输入有误",
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const before = await tx.project.findUnique({ where: { id } });
      if (!before) throw new Error("NOT_FOUND");

      const after = await tx.project.update({
        where: { id },
        data: {
          name: parsed.data.name,
          code: parsed.data.code,
          purpose: parsed.data.purpose,
          description: parsed.data.description || null,
        },
      });
      await tx.auditLog.create({
        data: buildAuditData({
          userId: actor.id,
          action: "UPDATE_PROJECT",
          entityType: "Project",
          entityId: id,
          changes: { before, after },
        }),
      });
    });

    revalidatePath("/projects");
    return { success: true };
  } catch (e) {
    if (e instanceof Error && e.message === "NOT_FOUND") {
      return { success: false, error: "项目不存在" };
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

export async function toggleProjectActiveAction(
  id: string,
): Promise<ActionResult<{ isActive: boolean }>> {
  const actor = await getActor();
  if (!actor) return { success: false, error: "未登录" };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.project.findUnique({ where: { id } });
      if (!before) throw new Error("NOT_FOUND");

      const after = await tx.project.update({
        where: { id },
        data: { isActive: !before.isActive },
      });
      await tx.auditLog.create({
        data: buildAuditData({
          userId: actor.id,
          action: after.isActive ? "ENABLE_PROJECT" : "DISABLE_PROJECT",
          entityType: "Project",
          entityId: id,
          changes: {
            before: { isActive: before.isActive },
            after: { isActive: after.isActive },
          },
        }),
      });
      return after;
    });

    revalidatePath("/projects");
    return { success: true, data: { isActive: result.isActive } };
  } catch (e) {
    if (e instanceof Error && e.message === "NOT_FOUND") {
      return { success: false, error: "项目不存在" };
    }
    return { success: false, error: "状态切换失败，请重试" };
  }
}
