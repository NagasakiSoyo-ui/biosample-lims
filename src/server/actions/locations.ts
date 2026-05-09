"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma, type LocationLevel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActor } from "@/server/services/auth-guard";
import { buildAuditData } from "@/server/services/audit";
import {
  childLevelOf,
  getOrCreateSlot,
} from "@/server/services/locations";
import type { ActionResult } from "@/types/action";

const locationInputSchema = z.object({
  parentId: z.string().nullable(),
  name: z.string().min(1, "名称不能为空").max(50, "名称过长"),
  code: z.string().max(50, "编码过长").optional().or(z.literal("")),
  notes: z.string().max(500, "备注过长").optional().or(z.literal("")),
  gridRows: z.number().int().min(1).max(50).nullable().optional(),
  gridCols: z.number().int().min(1).max(50).nullable().optional(),
  // SLOT only: 0-based linear index in the parent BOX (row*cols + col)
  position: z.number().int().min(0).nullable().optional(),
});

export type LocationInput = z.infer<typeof locationInputSchema>;

export async function createLocationAction(
  input: LocationInput,
): Promise<ActionResult<{ id: string; level: LocationLevel }>> {
  const actor = await getActor();
  if (!actor) return { success: false, error: "未登录" };

  const parsed = locationInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "输入有误",
    };
  }

  // Derive level from parent
  let parentLevel: LocationLevel | null = null;
  let parentCapacity: number | null = null;
  if (parsed.data.parentId) {
    const parent = await prisma.location.findUnique({
      where: { id: parsed.data.parentId },
      select: { level: true, capacity: true },
    });
    if (!parent) return { success: false, error: "父节点不存在" };
    parentLevel = parent.level;
    parentCapacity = parent.capacity;
  }
  const level = childLevelOf(parentLevel);
  if (!level) {
    return { success: false, error: "该位置层级不能再添加子节点" };
  }

  if (
    level === "BOX" &&
    (!parsed.data.gridRows || !parsed.data.gridCols)
  ) {
    return { success: false, error: "冻存盒必须设置行数和列数" };
  }

  if (level === "SLOT") {
    if (typeof parsed.data.position !== "number") {
      return { success: false, error: "孔位必须指定位置" };
    }
    if (parentCapacity == null) {
      return { success: false, error: "父冻存盒数据异常（缺少容量）" };
    }
    if (
      parsed.data.position < 0 ||
      parsed.data.position >= parentCapacity
    ) {
      return { success: false, error: "位置超出冻存盒容量" };
    }
  }

  const data: Prisma.LocationUncheckedCreateInput = {
    name: parsed.data.name,
    code: parsed.data.code || null,
    level,
    parentId: parsed.data.parentId,
    notes: parsed.data.notes || null,
  };

  if (level === "BOX") {
    data.gridRows = parsed.data.gridRows!;
    data.gridCols = parsed.data.gridCols!;
    data.capacity = parsed.data.gridRows! * parsed.data.gridCols!;
  }

  if (level === "SLOT") {
    data.position = parsed.data.position!;
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const created = await tx.location.create({ data });
      await tx.auditLog.create({
        data: buildAuditData({
          userId: actor.id,
          action: "CREATE_LOCATION",
          entityType: "Location",
          entityId: created.id,
          changes: { after: created },
        }),
      });
      return created;
    });
    revalidatePath("/locations");
    return { success: true, data: { id: created.id, level: created.level } };
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return { success: false, error: "该位置已被占用" };
    }
    return { success: false, error: "创建失败，请重试" };
  }
}

const updateInputSchema = z.object({
  name: z.string().min(1, "名称不能为空").max(50, "名称过长"),
  code: z.string().max(50, "编码过长").optional().or(z.literal("")),
  notes: z.string().max(500, "备注过长").optional().or(z.literal("")),
  gridRows: z.number().int().min(1).max(50).nullable().optional(),
  gridCols: z.number().int().min(1).max(50).nullable().optional(),
});

export type LocationUpdateInput = z.infer<typeof updateInputSchema>;

export async function updateLocationAction(
  id: string,
  input: LocationUpdateInput,
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

  const before = await prisma.location.findUnique({
    where: { id },
    include: { _count: { select: { children: true } } },
  });
  if (!before) return { success: false, error: "节点不存在" };

  const data: Prisma.LocationUncheckedUpdateInput = {
    name: parsed.data.name,
    code: parsed.data.code || null,
    notes: parsed.data.notes || null,
  };

  if (before.level === "BOX") {
    if (!parsed.data.gridRows || !parsed.data.gridCols) {
      return { success: false, error: "冻存盒必须设置行数和列数" };
    }
    const newCapacity = parsed.data.gridRows * parsed.data.gridCols;
    // Guard: SLOT children must fit within new dimensions.
    if (before._count.children > newCapacity) {
      return {
        success: false,
        error: `无法缩小，存在 ${before._count.children} 个 SLOT 占用`,
      };
    }
    data.gridRows = parsed.data.gridRows;
    data.gridCols = parsed.data.gridCols;
    data.capacity = newCapacity;
  }

  try {
    await prisma.$transaction(async (tx) => {
      const after = await tx.location.update({ where: { id }, data });
      await tx.auditLog.create({
        data: buildAuditData({
          userId: actor.id,
          action: "UPDATE_LOCATION",
          entityType: "Location",
          entityId: id,
          changes: { before, after },
        }),
      });
    });
    revalidatePath("/locations");
    return { success: true };
  } catch {
    return { success: false, error: "更新失败，请重试" };
  }
}

export async function toggleLocationActiveAction(
  id: string,
): Promise<ActionResult<{ isActive: boolean }>> {
  const actor = await getActor();
  if (!actor) return { success: false, error: "未登录" };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.location.findUnique({ where: { id } });
      if (!before) throw new Error("NOT_FOUND");
      const after = await tx.location.update({
        where: { id },
        data: { isActive: !before.isActive },
      });
      await tx.auditLog.create({
        data: buildAuditData({
          userId: actor.id,
          action: after.isActive ? "ENABLE_LOCATION" : "DISABLE_LOCATION",
          entityType: "Location",
          entityId: id,
          changes: {
            before: { isActive: before.isActive },
            after: { isActive: after.isActive },
          },
        }),
      });
      return after;
    });
    revalidatePath("/locations");
    return { success: true, data: { isActive: result.isActive } };
  } catch (e) {
    if (e instanceof Error && e.message === "NOT_FOUND") {
      return { success: false, error: "节点不存在" };
    }
    return { success: false, error: "状态切换失败，请重试" };
  }
}

// Used by LocationPicker when the user clicks an empty cell in a BOX grid.
// Idempotent — returns the existing SLOT if one already lives at that
// position. Audit row is only written on actual creation.
export async function getOrCreateSlotAction(
  boxId: string,
  position: number,
): Promise<
  ActionResult<{ id: string; name: string; position: number; isNew: boolean }>
> {
  const actor = await getActor();
  if (!actor) return { success: false, error: "未登录" };

  if (!Number.isInteger(position) || position < 0) {
    return { success: false, error: "位置参数无效" };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      return await getOrCreateSlot(tx, {
        boxId,
        position,
        actorId: actor.id,
      });
    });
    if (result.isNew) {
      revalidatePath("/locations");
    }
    return { success: true, data: result };
  } catch (e) {
    if (e instanceof Error) {
      if (e.message === "INVALID_BOX") {
        return { success: false, error: "指定的冻存盒不存在" };
      }
      if (e.message === "POSITION_OUT_OF_RANGE") {
        return { success: false, error: "位置超出冻存盒容量" };
      }
    }
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return { success: false, error: "该位置已被占用" };
    }
    return { success: false, error: "创建孔位失败，请重试" };
  }
}

export async function deleteLocationAction(
  id: string,
): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return { success: false, error: "未登录" };

  const before = await prisma.location.findUnique({
    where: { id },
    include: { _count: { select: { children: true, samples: true } } },
  });
  if (!before) return { success: false, error: "节点不存在" };
  if (before._count.children > 0) {
    return {
      success: false,
      error: `请先删除该节点下的 ${before._count.children} 个子节点`,
    };
  }
  if (before._count.samples > 0) {
    return {
      success: false,
      error: `该节点下还有 ${before._count.samples} 条样本占用，无法删除`,
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.location.delete({ where: { id } });
      await tx.auditLog.create({
        data: buildAuditData({
          userId: actor.id,
          action: "DELETE_LOCATION",
          entityType: "Location",
          entityId: id,
          changes: { before },
        }),
      });
    });
    revalidatePath("/locations");
    return { success: true };
  } catch {
    return { success: false, error: "删除失败，请重试" };
  }
}
