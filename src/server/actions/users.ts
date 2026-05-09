"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActor } from "@/server/services/auth-guard";
import { buildAuditData } from "@/server/services/audit";
import type { ActionResult } from "@/types/action";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function requireAdmin() {
  const actor = await getActor();
  if (!actor) return { ok: false as const, error: "未登录" };
  if (actor.role !== "ADMIN") return { ok: false as const, error: "无权限" };
  return { ok: true as const, actor };
}

// Returns the count of active ADMIN users excluding the given userId.
async function activeAdminCountExcluding(
  tx: Prisma.TransactionClient | typeof prisma,
  excludeUserId: string,
): Promise<number> {
  return tx.user.count({
    where: {
      role: "ADMIN",
      isActive: true,
      NOT: { id: excludeUserId },
    },
  });
}

// ---------------------------------------------------------------------------
// Create user
// ---------------------------------------------------------------------------

const createInput = z.object({
  email: z.string().email("请输入有效的邮箱"),
  name: z.string().min(1, "姓名不能为空").max(50, "姓名过长"),
  role: z.enum(["ADMIN", "USER"]),
  password: z.string().min(8, "密码至少 8 位").max(128, "密码过长"),
});

export type CreateUserInput = z.infer<typeof createInput>;

export async function createUserAction(
  input: CreateUserInput,
): Promise<ActionResult<{ id: string }>> {
  const guard = await requireAdmin();
  if (!guard.ok) return { success: false, error: guard.error };

  const parsed = createInput.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "输入有误",
    };
  }
  try {
    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const created = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: parsed.data.email,
          name: parsed.data.name,
          role: parsed.data.role,
          passwordHash,
        },
      });
      await tx.auditLog.create({
        data: buildAuditData({
          userId: guard.actor.id,
          action: "CREATE_USER",
          entityType: "User",
          entityId: created.id,
          changes: {
            after: {
              email: created.email,
              name: created.name,
              role: created.role,
            },
          },
        }),
      });
      return created;
    });
    revalidatePath("/users");
    return { success: true, data: { id: created.id } };
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return { success: false, error: "邮箱已被使用" };
    }
    return { success: false, error: "创建失败，请重试" };
  }
}

// ---------------------------------------------------------------------------
// Update user (name + role)
// ---------------------------------------------------------------------------

const updateInput = z.object({
  name: z.string().min(1, "姓名不能为空").max(50, "姓名过长"),
  role: z.enum(["ADMIN", "USER"]),
});

export type UpdateUserInput = z.infer<typeof updateInput>;

export async function updateUserAction(
  id: string,
  input: UpdateUserInput,
): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return { success: false, error: guard.error };

  const parsed = updateInput.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "输入有误",
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const before = await tx.user.findUnique({ where: { id } });
      if (!before) throw new Error("NOT_FOUND");
      // Invariant: never allow demoting the last active ADMIN.
      if (
        before.role === "ADMIN" &&
        before.isActive &&
        parsed.data.role === "USER"
      ) {
        const others = await activeAdminCountExcluding(tx, id);
        if (others === 0) throw new Error("LAST_ADMIN");
      }
      const after = await tx.user.update({
        where: { id },
        data: { name: parsed.data.name, role: parsed.data.role },
      });
      await tx.auditLog.create({
        data: buildAuditData({
          userId: guard.actor.id,
          action: "UPDATE_USER",
          entityType: "User",
          entityId: id,
          changes: {
            before: { name: before.name, role: before.role },
            after: { name: after.name, role: after.role },
          },
        }),
      });
    });
    revalidatePath("/users");
    return { success: true };
  } catch (e) {
    if (e instanceof Error) {
      if (e.message === "NOT_FOUND")
        return { success: false, error: "用户不存在" };
      if (e.message === "LAST_ADMIN")
        return {
          success: false,
          error: "系统至少需要保留 1 个启用状态的管理员",
        };
    }
    return { success: false, error: "更新失败，请重试" };
  }
}

// ---------------------------------------------------------------------------
// Toggle user active
// ---------------------------------------------------------------------------

export async function toggleUserActiveAction(
  id: string,
): Promise<ActionResult<{ isActive: boolean }>> {
  const guard = await requireAdmin();
  if (!guard.ok) return { success: false, error: guard.error };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.user.findUnique({ where: { id } });
      if (!before) throw new Error("NOT_FOUND");
      // Invariant: cannot disable the last active ADMIN.
      if (before.isActive && before.role === "ADMIN") {
        const others = await activeAdminCountExcluding(tx, id);
        if (others === 0) throw new Error("LAST_ADMIN");
      }
      const after = await tx.user.update({
        where: { id },
        data: { isActive: !before.isActive },
      });
      await tx.auditLog.create({
        data: buildAuditData({
          userId: guard.actor.id,
          action: after.isActive ? "ENABLE_USER" : "DISABLE_USER",
          entityType: "User",
          entityId: id,
          changes: {
            before: { isActive: before.isActive },
            after: { isActive: after.isActive },
          },
        }),
      });
      return after;
    });
    revalidatePath("/users");
    return { success: true, data: { isActive: result.isActive } };
  } catch (e) {
    if (e instanceof Error) {
      if (e.message === "NOT_FOUND")
        return { success: false, error: "用户不存在" };
      if (e.message === "LAST_ADMIN")
        return {
          success: false,
          error: "无法停用最后一个启用状态的管理员",
        };
    }
    return { success: false, error: "状态切换失败，请重试" };
  }
}

// ---------------------------------------------------------------------------
// Reset password (admin resetting another user's password)
// ---------------------------------------------------------------------------

const resetInput = z.object({
  newPassword: z.string().min(8, "密码至少 8 位").max(128, "密码过长"),
});

export type ResetPasswordInput = z.infer<typeof resetInput>;

export async function resetUserPasswordAction(
  id: string,
  input: ResetPasswordInput,
): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return { success: false, error: guard.error };

  const parsed = resetInput.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "输入有误",
    };
  }
  try {
    await prisma.$transaction(async (tx) => {
      const before = await tx.user.findUnique({ where: { id } });
      if (!before) throw new Error("NOT_FOUND");
      const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
      await tx.user.update({ where: { id }, data: { passwordHash } });
      await tx.auditLog.create({
        data: buildAuditData({
          userId: guard.actor.id,
          action: "RESET_USER_PASSWORD",
          entityType: "User",
          entityId: id,
          // Don't log the password itself.
          changes: { after: { resetBy: guard.actor.id } },
        }),
      });
    });
    revalidatePath("/users");
    return { success: true };
  } catch (e) {
    if (e instanceof Error && e.message === "NOT_FOUND") {
      return { success: false, error: "用户不存在" };
    }
    return { success: false, error: "重置失败，请重试" };
  }
}

// ---------------------------------------------------------------------------
// Change own password (used by /settings)
// ---------------------------------------------------------------------------

const changeOwnInput = z.object({
  oldPassword: z.string().min(1, "请输入当前密码"),
  newPassword: z.string().min(8, "新密码至少 8 位").max(128, "密码过长"),
});

export type ChangeOwnPasswordInput = z.infer<typeof changeOwnInput>;

export async function changeOwnPasswordAction(
  input: ChangeOwnPasswordInput,
): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return { success: false, error: "未登录" };

  const parsed = changeOwnInput.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "输入有误",
    };
  }
  try {
    const me = await prisma.user.findUnique({ where: { id: actor.id } });
    if (!me) return { success: false, error: "账号不存在" };
    const ok = await bcrypt.compare(parsed.data.oldPassword, me.passwordHash);
    if (!ok) return { success: false, error: "当前密码错误" };

    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: actor.id }, data: { passwordHash } });
      await tx.auditLog.create({
        data: buildAuditData({
          userId: actor.id,
          action: "RESET_USER_PASSWORD",
          entityType: "User",
          entityId: actor.id,
          changes: { after: { selfChange: true } },
        }),
      });
    });
    return { success: true };
  } catch {
    return { success: false, error: "修改失败，请重试" };
  }
}
