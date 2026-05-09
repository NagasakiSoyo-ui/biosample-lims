"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActor } from "@/server/services/auth-guard";
import { buildAuditData } from "@/server/services/audit";
import { getOrCreateSlot } from "@/server/services/locations";
import {
  buildTemplateBuffer,
  parseImportSheet,
  validateRows,
  type ImportContext,
  type ImportRowResult,
  type ImportResolved,
} from "@/server/services/excel";
import { parseCustomFieldsSchema } from "@/server/services/samples";
import type { ActionResult } from "@/types/action";

// ---------------------------------------------------------------------------
// Build the validation context once, used by both parse + confirm flows.
// ---------------------------------------------------------------------------

async function buildContext(): Promise<ImportContext> {
  const [projects, types, donors, sourceOrgs, parents, allLocations, occSamples] =
    await Promise.all([
      prisma.project.findMany({
        select: { id: true, code: true, isActive: true },
      }),
      prisma.sampleType.findMany({
        select: {
          id: true,
          code: true,
          isActive: true,
          customFieldsSchema: true,
        },
      }),
      prisma.donor.findMany({ select: { id: true, code: true } }),
      prisma.sourceOrg.findMany({ select: { id: true, name: true } }),
      prisma.sample.findMany({
        select: { id: true, sampleCode: true, projectId: true },
      }),
      prisma.location.findMany({
        select: {
          id: true,
          name: true,
          level: true,
          parentId: true,
          gridCols: true,
          capacity: true,
        },
      }),
      prisma.sample.findMany({
        where: {
          locationId: { not: null },
          status: {
            notIn: ["DEPLETED", "DISCARDED", "VOIDED", "RELEASED"],
          },
        },
        select: { locationId: true },
      }),
    ]);

  const projectsByCode = new Map<string, { id: string; isActive: boolean }>();
  for (const p of projects)
    projectsByCode.set(p.code, { id: p.id, isActive: p.isActive });

  const typesByCode = new Map<
    string,
    { id: string; isActive: boolean; schema: ReturnType<typeof parseCustomFieldsSchema> }
  >();
  for (const t of types) {
    typesByCode.set(t.code, {
      id: t.id,
      isActive: t.isActive,
      schema: parseCustomFieldsSchema(t.customFieldsSchema),
    });
  }

  const donorsByCode = new Map<string, string>();
  for (const d of donors) donorsByCode.set(d.code, d.id);

  const sourceOrgsByName = new Map<string, string>();
  for (const s of sourceOrgs) sourceOrgsByName.set(s.name, s.id);

  // Sample-code lookup is global (first match wins). For lab-scale data this
  // is fine; spec says parentSampleCode lookup is by code only.
  const parentByCode = new Map<string, string>();
  for (const s of parents) {
    if (!parentByCode.has(s.sampleCode)) parentByCode.set(s.sampleCode, s.id);
  }

  const existingByProject = new Map<string, Set<string>>();
  for (const s of parents) {
    const set = existingByProject.get(s.projectId) ?? new Set<string>();
    set.add(s.sampleCode);
    existingByProject.set(s.projectId, set);
  }

  // Build locationsByPath: full key = lower(name1)|lower(name2)|...
  const byId = new Map<string, (typeof allLocations)[number]>();
  for (const l of allLocations) byId.set(l.id, l);

  function pathOf(id: string): string[] {
    const out: string[] = [];
    let cur: string | null = id;
    for (let i = 0; cur && i < 8; i++) {
      const node = byId.get(cur);
      if (!node) break;
      out.unshift(node.name);
      cur = node.parentId;
    }
    return out;
  }

  const locationsByPath = new Map<
    string,
    { id: string; level: string; gridCols: number | null; capacity: number | null }
  >();
  for (const l of allLocations) {
    const parts = pathOf(l.id);
    const key = parts.map((p) => p.trim().toLowerCase()).join("|");
    locationsByPath.set(key, {
      id: l.id,
      level: l.level,
      gridCols: l.gridCols,
      capacity: l.capacity,
    });
  }

  const occupiedSlotIds = new Set<string>();
  for (const s of occSamples) {
    if (s.locationId) occupiedSlotIds.add(s.locationId);
  }

  return {
    projectsByCode,
    typesByCode,
    donorsByCode,
    sourceOrgsByName,
    parentByCode,
    locationsByPath,
    existingByProject,
    occupiedSlotIds,
  };
}

// ---------------------------------------------------------------------------
// Template download
// ---------------------------------------------------------------------------

export async function downloadTemplateAction(): Promise<
  ActionResult<{ filename: string; base64: string }>
> {
  const actor = await getActor();
  if (!actor) return { success: false, error: "未登录" };

  const [projects, types] = await Promise.all([
    prisma.project.findMany({
      select: { code: true, name: true, isActive: true },
      orderBy: { code: "asc" },
    }),
    prisma.sampleType.findMany({
      select: {
        code: true,
        name: true,
        isActive: true,
        customFieldsSchema: true,
      },
      orderBy: { code: "asc" },
    }),
  ]);

  const buffer = await buildTemplateBuffer({ projects, types });
  const base64 = buffer.toString("base64");
  return {
    success: true,
    data: {
      filename: `biosample-import-template-${Date.now()}.xlsx`,
      base64,
    },
  };
}

// ---------------------------------------------------------------------------
// Upload + validate (server reads file, returns row results)
// ---------------------------------------------------------------------------

export async function parseImportAction(
  formData: FormData,
): Promise<ActionResult<{ rows: ImportRowResult[] }>> {
  const actor = await getActor();
  if (!actor) return { success: false, error: "未登录" };

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { success: false, error: "未选择文件" };
  }
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  let raws;
  try {
    raws = parseImportSheet(buffer);
  } catch {
    return { success: false, error: "无法解析 Excel 文件，请使用模板" };
  }
  if (raws.length === 0) {
    return { success: false, error: "样本数据 sheet 为空" };
  }

  const ctx = await buildContext();
  const rows = validateRows(raws, ctx);

  return { success: true, data: { rows } };
}

// ---------------------------------------------------------------------------
// Confirm import: persist all rows whose status === "OK" or "WARNING"
// ---------------------------------------------------------------------------

export async function confirmImportAction(
  rows: ImportRowResult[],
): Promise<ActionResult<{ created: number; skipped: number }>> {
  const actor = await getActor();
  if (!actor) return { success: false, error: "未登录" };

  const importable = rows.filter(
    (r) => r.status !== "ERROR" && r.resolved !== null,
  );
  if (importable.length === 0) {
    return { success: false, error: "没有可导入的行" };
  }

  let created = 0;
  let skipped = rows.length - importable.length;
  const createdIds: string[] = [];
  const failedRows: number[] = [];

  // Process in chunks to keep transaction time bounded.
  const CHUNK = 50;
  for (let i = 0; i < importable.length; i += CHUNK) {
    const chunk = importable.slice(i, i + CHUNK);
    try {
      const ids = await prisma.$transaction(
        async (tx) => {
          const idsThisBatch: string[] = [];
          for (const row of chunk) {
            const r = row.resolved as ImportResolved;
            let locationId = r.locationId;
            if (!locationId && r.pendingSlot) {
              const slot = await getOrCreateSlot(tx, {
                boxId: r.pendingSlot.boxId,
                position: r.pendingSlot.position,
                actorId: actor.id,
              });
              locationId = slot.id;
            }
            const newRow = await tx.sample.create({
              data: {
                sampleCode: r.sampleCode,
                typeId: r.typeId,
                projectId: r.projectId,
                sourceOrgId: r.sourceOrgId,
                donorId: r.donorId,
                parentSampleId: r.parentSampleId,
                locationId,
                purpose: r.purpose,
                status: "AVAILABLE",
                volume: r.volume,
                volumeUnit: r.volumeUnit,
                collectedAt: r.collectedAt ? new Date(r.collectedAt) : null,
                frozenAt: r.frozenAt ? new Date(r.frozenAt) : null,
                expireAt: r.expireAt ? new Date(r.expireAt) : null,
                freezeThawCount: 0,
                customFields: r.customFields as unknown as Prisma.InputJsonValue,
                notes: r.notes,
                createdById: actor.id,
              },
            });
            if (locationId) {
              await tx.sampleTransaction.create({
                data: {
                  sampleId: newRow.id,
                  type: "INBOUND",
                  toLocationId: locationId,
                  newStatus: "AVAILABLE",
                  operatorId: actor.id,
                  reason: "Excel 批量导入",
                },
              });
            }
            idsThisBatch.push(newRow.id);
          }
          return idsThisBatch;
        },
        { timeout: 30_000 },
      );
      created += ids.length;
      createdIds.push(...ids);
    } catch {
      // Mark this whole chunk as failed; continue with next chunk so a
      // single bad row doesn't sink the whole import.
      for (const row of chunk) failedRows.push(row.rowIndex);
      skipped += chunk.length;
    }
  }

  // One audit row summarizing the import.
  await prisma.auditLog.create({
    data: buildAuditData({
      userId: actor.id,
      action: "BATCH_IMPORT_SAMPLES",
      entityType: "Sample",
      changes: {
        after: {
          totalRows: rows.length,
          imported: created,
          skipped,
          createdIds,
          failedRows,
        },
      },
    }),
  });

  revalidatePath("/samples");
  return { success: true, data: { created, skipped } };
}
