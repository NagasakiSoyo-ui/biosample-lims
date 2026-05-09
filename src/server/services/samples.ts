import type { Prisma, SampleStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// sampleCode generator: {project.code}-{type.code}-{YYMMDD}-{NN}
// NN is the per-(project, type, day) sequence, padded to 2 digits.
// Caller is expected to set createdAt close to "now" — generation uses the
// server's local date.
// ---------------------------------------------------------------------------

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function formatYymmdd(date: Date): string {
  return `${String(date.getFullYear()).slice(-2)}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`;
}

export async function generateSampleCode(
  client: Prisma.TransactionClient,
  args: { projectId: string; typeId: string; date?: Date },
): Promise<string | null> {
  const date = args.date ?? new Date();
  const [project, type] = await Promise.all([
    client.project.findUnique({
      where: { id: args.projectId },
      select: { code: true },
    }),
    client.sampleType.findUnique({
      where: { id: args.typeId },
      select: { code: true },
    }),
  ]);
  if (!project || !type) return null;

  const day0 = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day1 = new Date(day0.getTime() + 24 * 3600 * 1000);
  const count = await client.sample.count({
    where: {
      projectId: args.projectId,
      typeId: args.typeId,
      createdAt: { gte: day0, lt: day1 },
    },
  });

  const seq = pad2(count + 1);
  return `${project.code}-${type.code}-${formatYymmdd(date)}-${seq}`;
}

// ---------------------------------------------------------------------------
// Custom-field schema validation: validate Sample.customFields against the
// type's customFieldsSchema. Returns null on success, or a Chinese error
// message describing the first failure.
// ---------------------------------------------------------------------------

export type CustomFieldSpec = {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "boolean";
  required: boolean;
  options?: string[];
};

export function parseCustomFieldsSchema(raw: unknown): CustomFieldSpec[] {
  if (!Array.isArray(raw)) return [];
  return raw as CustomFieldSpec[];
}

export function validateCustomFields(
  schema: CustomFieldSpec[],
  values: Record<string, unknown>,
): string | null {
  for (const field of schema) {
    const v = values[field.key];
    const isEmpty = v === undefined || v === null || v === "";
    if (field.required && isEmpty) {
      return `「${field.label}」不能为空`;
    }
    if (isEmpty) continue;
    switch (field.type) {
      case "number": {
        if (typeof v !== "number" && Number.isNaN(Number(v))) {
          return `「${field.label}」必须为数字`;
        }
        break;
      }
      case "boolean": {
        if (typeof v !== "boolean") {
          return `「${field.label}」必须为是/否`;
        }
        break;
      }
      case "date": {
        const d = new Date(v as string);
        if (isNaN(d.getTime())) {
          return `「${field.label}」必须为有效日期`;
        }
        break;
      }
      case "select": {
        if (
          field.options &&
          field.options.length > 0 &&
          !field.options.includes(String(v))
        ) {
          return `「${field.label}」必须是预设选项之一`;
        }
        break;
      }
    }
  }
  return null;
}

// Coerce raw user input into typed values (e.g. number-string → number).
export function coerceCustomFields(
  schema: CustomFieldSpec[],
  values: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of schema) {
    const v = values[field.key];
    if (v === undefined || v === null || v === "") continue;
    switch (field.type) {
      case "number":
        out[field.key] = typeof v === "number" ? v : Number(v);
        break;
      case "boolean":
        out[field.key] = typeof v === "boolean" ? v : v === "true" || v === true;
        break;
      default:
        out[field.key] = v;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Lineage: walk up to root, then build the descendant tree from there.
// LineageNode is what the SVG component receives.
// ---------------------------------------------------------------------------

export type LineageNode = {
  id: string;
  sampleCode: string;
  status: SampleStatus;
  typeName: string;
  typeIcon: string | null;
  parentId: string | null;
  children: LineageNode[];
};

async function findRoot(
  client: Prisma.TransactionClient,
  startId: string,
): Promise<string> {
  let id = startId;
  for (let i = 0; i < 32; i++) {
    const row = await client.sample.findUnique({
      where: { id },
      select: { parentSampleId: true },
    });
    if (!row?.parentSampleId) return id;
    id = row.parentSampleId;
  }
  return id;
}

async function buildSubtree(
  client: Prisma.TransactionClient,
  id: string,
): Promise<LineageNode | null> {
  const row = await client.sample.findUnique({
    where: { id },
    select: {
      id: true,
      sampleCode: true,
      status: true,
      parentSampleId: true,
      type: { select: { name: true, icon: true } },
    },
  });
  if (!row) return null;
  const childIds = await client.sample.findMany({
    where: { parentSampleId: id },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  const children: LineageNode[] = [];
  for (const c of childIds) {
    const sub = await buildSubtree(client, c.id);
    if (sub) children.push(sub);
  }
  return {
    id: row.id,
    sampleCode: row.sampleCode,
    status: row.status,
    typeName: row.type.name,
    typeIcon: row.type.icon,
    parentId: row.parentSampleId,
    children,
  };
}

export async function getSampleLineage(
  client: Prisma.TransactionClient,
  sampleId: string,
): Promise<{ root: LineageNode | null; currentId: string }> {
  const rootId = await findRoot(client, sampleId);
  const root = await buildSubtree(client, rootId);
  return { root, currentId: sampleId };
}

// ---------------------------------------------------------------------------
// Status / purpose / transaction-type label maps for UI use.
// ---------------------------------------------------------------------------

export const SAMPLE_STATUS_LABEL: Record<SampleStatus, string> = {
  AVAILABLE: "可用",
  IN_USE: "使用中",
  QUARANTINE: "隔离中",
  RELEASED: "已放行",
  DEPLETED: "已用完",
  DISCARDED: "已销毁",
  VOIDED: "已作废",
};

export const SAMPLE_PURPOSE_LABEL: Record<"RESEARCH" | "CLINICAL_INFUSION", string> = {
  RESEARCH: "研究",
  CLINICAL_INFUSION: "临床回输",
};

export const VOLUME_UNITS = ["mL", "μL", "vial", "mg", "cells"] as const;
export type VolumeUnit = (typeof VOLUME_UNITS)[number];

export const TX_TYPE_LABEL: Record<
  "INBOUND" | "OUTBOUND" | "MOVE" | "FREEZE_THAW" | "STATUS_CHANGE" | "DISCARD",
  string
> = {
  INBOUND: "入库",
  OUTBOUND: "出库",
  MOVE: "移位",
  FREEZE_THAW: "冻融",
  STATUS_CHANGE: "状态变更",
  DISCARD: "销毁",
};
