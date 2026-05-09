import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { parseCustomFieldsSchema, type CustomFieldSpec } from "./samples";

// ---------------------------------------------------------------------------
// Template generator
// ---------------------------------------------------------------------------

const FIXED_COLUMNS = [
  "projectCode",
  "typeCode",
  "sampleCode",
  "locationPath",
  "purpose",
  "donorCode",
  "sourceOrgName",
  "parentSampleCode",
  "volume",
  "volumeUnit",
  "collectedAt",
  "frozenAt",
  "expireAt",
  "notes",
] as const;

type ProjectMeta = { code: string; name: string; isActive: boolean };
type TypeMeta = {
  code: string;
  name: string;
  isActive: boolean;
  customFieldsSchema: unknown;
};

// Build the import template using exceljs so we can attach real data
// validation dropdowns. xlsx (sheetjs community) cannot reliably write
// dataValidations.
export async function buildTemplateBuffer(args: {
  projects: ProjectMeta[];
  types: TypeMeta[];
}): Promise<Buffer> {
  // Collect cf_ field metadata across active types: key → type, plus union of
  // options for select-type fields.
  const cfKeyToType = new Map<string, CustomFieldSpec["type"]>();
  const cfKeyToOptions = new Map<string, Set<string>>();
  for (const t of args.types) {
    if (!t.isActive) continue;
    for (const f of parseCustomFieldsSchema(t.customFieldsSchema)) {
      cfKeyToType.set(f.key, f.type);
      if (f.type === "select" && f.options) {
        const set = cfKeyToOptions.get(f.key) ?? new Set<string>();
        f.options.forEach((o) => set.add(o));
        cfKeyToOptions.set(f.key, set);
      }
    }
  }
  const cfCols = Array.from(cfKeyToType.keys())
    .sort()
    .map((k) => `cf_${k}`);
  const headers = [...FIXED_COLUMNS, ...cfCols];

  const example = headers.map((h) => {
    switch (h) {
      case "projectCode":
        return args.projects[0]?.code ?? "GBM";
      case "typeCode":
        return args.types[0]?.code ?? "TIL";
      case "sampleCode":
        return "GBM-TIL-250509-99";
      case "locationPath":
        return "液氮罐A > 提筒1 > 盒1 > A1";
      case "purpose":
        return "研究";
      case "volume":
        return "1.5";
      case "volumeUnit":
        return "mL";
      case "collectedAt":
        return "2025-05-09";
      default:
        return "";
    }
  });

  const wb = new ExcelJS.Workbook();

  // ---- Sheet 1: 样本数据 ----
  const sheet1 = wb.addWorksheet("样本数据");
  sheet1.addRow(headers);
  sheet1.getRow(1).font = { bold: true };
  sheet1.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFEFEFEF" },
  };
  sheet1.addRow(example);
  sheet1.columns.forEach((col) => {
    col.width = 18;
  });

  // ---- Sheet 2: 字段说明 ----
  const sheet2 = wb.addWorksheet("字段说明");
  const fieldDocs: Array<[string, string, string, string]> = [
    ["列名", "必填", "格式", "说明"],
    ["projectCode", "是", "字母数字", "项目代码（下拉来自「项目代码对照」）"],
    ["typeCode", "是", "字母数字", "样本类型代码（下拉来自「样本类型对照」）"],
    ["sampleCode", "是", "字符串", "样本编号；项目内唯一"],
    [
      "locationPath",
      "是",
      "罐 > 提筒 > 盒 > 孔",
      "完整路径，用 ' > ' 分隔；末端不存在的孔位会自动创建",
    ],
    [
      "purpose",
      "是",
      "研究 / 临床回输 / RESEARCH / CLINICAL_INFUSION",
      "样本用途（下拉）",
    ],
    ["donorCode", "否", "字符串", "供者脱敏 ID（必须已存在）"],
    ["sourceOrgName", "否", "字符串", "来源单位名称（必须已存在）"],
    ["parentSampleCode", "否", "字符串", "母样本编号（必须已存在）"],
    ["volume", "否", "数字", "体积或数量"],
    ["volumeUnit", "否", "mL / μL / vial / mg / cells", "单位（下拉）"],
    ["collectedAt", "否", "YYYY-MM-DD", "采集日期"],
    ["frozenAt", "否", "YYYY-MM-DD", "冻存日期"],
    ["expireAt", "否", "YYYY-MM-DD", "有效期"],
    ["notes", "否", "字符串", "备注"],
    [
      "cf_<key>",
      "视类型而定",
      "按类型 customFieldsSchema",
      "动态字段；select 类型已绑定下拉",
    ],
  ];
  fieldDocs.forEach((r) => sheet2.addRow(r));
  sheet2.getRow(1).font = { bold: true };
  sheet2.columns.forEach((col, i) => {
    col.width = i === 3 ? 50 : 18;
  });

  // ---- Sheet 3: 项目代码对照 ----
  const sheet3 = wb.addWorksheet("项目代码对照");
  sheet3.addRow(["code", "name", "isActive"]);
  args.projects.forEach((p) =>
    sheet3.addRow([p.code, p.name, p.isActive ? "是" : "否"]),
  );
  sheet3.getRow(1).font = { bold: true };
  sheet3.columns.forEach((c) => (c.width = 18));

  // ---- Sheet 4: 样本类型对照 ----
  const sheet4 = wb.addWorksheet("样本类型对照");
  sheet4.addRow(["code", "name", "isActive", "customFields"]);
  args.types.forEach((t) => {
    const fields = parseCustomFieldsSchema(t.customFieldsSchema);
    sheet4.addRow([
      t.code,
      t.name,
      t.isActive ? "是" : "否",
      fields
        .map((f) => `${f.key}(${f.type}${f.required ? "*" : ""})`)
        .join(", "),
    ]);
  });
  sheet4.getRow(1).font = { bold: true };
  sheet4.columns.forEach((c, i) => (c.width = i === 3 ? 50 : 18));

  // ---- Data validations on sheet 1 ----
  const projCount = args.projects.length;
  const typeCount = args.types.length;
  const VALIDATION_ROWS = 1000; // pre-arm 1000 rows of dropdowns
  const FIXED_INDEX: Record<(typeof FIXED_COLUMNS)[number], number> = {
    projectCode: 1,
    typeCode: 2,
    sampleCode: 3,
    locationPath: 4,
    purpose: 5,
    donorCode: 6,
    sourceOrgName: 7,
    parentSampleCode: 8,
    volume: 9,
    volumeUnit: 10,
    collectedAt: 11,
    frozenAt: 12,
    expireAt: 13,
    notes: 14,
  };

  for (let row = 2; row <= VALIDATION_ROWS; row++) {
    if (projCount > 0) {
      sheet1.getCell(row, FIXED_INDEX.projectCode).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`'项目代码对照'!$A$2:$A$${projCount + 1}`],
        showErrorMessage: true,
        errorStyle: "stop",
        errorTitle: "无效项目代码",
        error: "请从「项目代码对照」中选择",
      };
    }
    if (typeCount > 0) {
      sheet1.getCell(row, FIXED_INDEX.typeCode).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`'样本类型对照'!$A$2:$A$${typeCount + 1}`],
        showErrorMessage: true,
        errorStyle: "stop",
        errorTitle: "无效样本类型代码",
        error: "请从「样本类型对照」中选择",
      };
    }
    sheet1.getCell(row, FIXED_INDEX.purpose).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"研究,临床回输,RESEARCH,CLINICAL_INFUSION"'],
    };
    sheet1.getCell(row, FIXED_INDEX.volumeUnit).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"mL,μL,vial,mg,cells"'],
    };

    cfCols.forEach((colName, i) => {
      const colIdx = FIXED_COLUMNS.length + i + 1;
      const key = colName.slice(3); // strip "cf_"
      const fieldType = cfKeyToType.get(key);
      if (fieldType === "select") {
        const opts = Array.from(cfKeyToOptions.get(key) ?? []);
        if (opts.length === 0) return;
        // Inline list: must be wrapped in double quotes; total length cap 255.
        const inline = `"${opts.join(",")}"`;
        if (inline.length > 255) return; // skip dropdown if too long
        sheet1.getCell(row, colIdx).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [inline],
        };
      } else if (fieldType === "boolean") {
        sheet1.getCell(row, colIdx).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: ['"是,否,true,false,1,0"'],
        };
      }
    });
  }

  // exceljs returns ExcelJS.Buffer (Uint8Array-compatible). Normalize to Node Buffer.
  const out = await wb.xlsx.writeBuffer();
  return Buffer.isBuffer(out) ? out : Buffer.from(out as ArrayBuffer);
}

// ---------------------------------------------------------------------------
// Parser + validator
// ---------------------------------------------------------------------------

export type ImportRowRaw = Record<string, string>;

export type ImportResolved = {
  projectId: string;
  typeId: string;
  typeSchema: CustomFieldSpec[];
  sampleCode: string;
  purpose: "RESEARCH" | "CLINICAL_INFUSION";
  donorId: string | null;
  sourceOrgId: string | null;
  parentSampleId: string | null;
  // Resolved location: either an existing locationId, or the (boxId, position)
  // pair to auto-create during import.
  locationId: string | null;
  pendingSlot: { boxId: string; position: number; cellLabel: string } | null;
  volume: number | null;
  volumeUnit: string | null;
  collectedAt: string | null;
  frozenAt: string | null;
  expireAt: string | null;
  customFields: Record<string, unknown>;
  notes: string | null;
};

export type ImportRowResult = {
  rowIndex: number;
  raw: ImportRowRaw;
  resolved: ImportResolved | null;
  status: "OK" | "ERROR" | "WARNING";
  errors: string[];
  warnings: string[];
};

export function parseImportSheet(buffer: Buffer): ImportRowRaw[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets["样本数据"] ?? wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<ImportRowRaw>(sheet, {
    defval: "",
    raw: false,
  });
}

// Reference data the validator needs.
export type ImportContext = {
  projectsByCode: Map<string, { id: string; isActive: boolean }>;
  typesByCode: Map<
    string,
    { id: string; isActive: boolean; schema: CustomFieldSpec[] }
  >;
  donorsByCode: Map<string, string>;
  sourceOrgsByName: Map<string, string>;
  parentByCode: Map<string, string>; // sampleCode (any project) → first id found
  // Locations indexed by parent path (lower-cased name chain joined by '|').
  locationsByPath: Map<string, { id: string; level: string; gridCols: number | null; capacity: number | null }>;
  // Existing sampleCodes per project
  existingByProject: Map<string, Set<string>>;
  // Slots already occupied (locationId set)
  occupiedSlotIds: Set<string>;
};

function pathKey(parts: string[]): string {
  return parts.map((p) => p.trim().toLowerCase()).join("|");
}

function parsePurpose(raw: string): "RESEARCH" | "CLINICAL_INFUSION" | null {
  const v = raw.trim();
  if (v === "" || v === "RESEARCH" || v === "研究") return "RESEARCH";
  if (v === "CLINICAL_INFUSION" || v === "临床回输") return "CLINICAL_INFUSION";
  return null;
}

function asNum(raw: string): number | null {
  const v = raw.trim();
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function asDateString(raw: string): string | null {
  const v = raw.trim();
  if (v === "") return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

import { parseCellLabel } from "./locations";

export function validateRows(
  rows: ImportRowRaw[],
  ctx: ImportContext,
): ImportRowResult[] {
  const out: ImportRowResult[] = [];

  // Per-batch in-flight reservations to detect within-file duplicates.
  const inFlightCodes = new Map<string, Set<string>>(); // projectId → codes
  const inFlightSlots = new Set<string>(); // existing slotId
  const inFlightPendingPositions = new Set<string>(); // boxId|position

  rows.forEach((raw, idx) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const rowIndex = idx + 2; // header is row 1

    // --- project ---
    const projectCode = (raw.projectCode ?? "").trim();
    const project = projectCode
      ? ctx.projectsByCode.get(projectCode)
      : undefined;
    if (!projectCode) errors.push("projectCode 不能为空");
    else if (!project) errors.push(`项目代码 ${projectCode} 不存在`);
    else if (!project.isActive) warnings.push(`项目 ${projectCode} 已禁用`);

    // --- type ---
    const typeCode = (raw.typeCode ?? "").trim();
    const type = typeCode ? ctx.typesByCode.get(typeCode) : undefined;
    if (!typeCode) errors.push("typeCode 不能为空");
    else if (!type) errors.push(`样本类型代码 ${typeCode} 不存在`);
    else if (!type.isActive)
      warnings.push(`样本类型 ${typeCode} 已禁用`);

    // --- sampleCode ---
    const sampleCode = (raw.sampleCode ?? "").trim();
    if (!sampleCode) errors.push("sampleCode 不能为空");
    else if (project) {
      const existing = ctx.existingByProject.get(project.id);
      if (existing && existing.has(sampleCode)) {
        errors.push(`样本编号 ${sampleCode} 在项目 ${projectCode} 下已存在`);
      }
      const reserved = inFlightCodes.get(project.id);
      if (reserved && reserved.has(sampleCode)) {
        errors.push(`样本编号 ${sampleCode} 在本次导入中重复`);
      }
    }

    // --- purpose ---
    const purpose = parsePurpose(raw.purpose ?? "");
    if (purpose === null)
      errors.push(
        "purpose 必须是 研究 / 临床回输 / RESEARCH / CLINICAL_INFUSION",
      );

    // --- donor ---
    const donorCode = (raw.donorCode ?? "").trim();
    let donorId: string | null = null;
    if (donorCode) {
      const id = ctx.donorsByCode.get(donorCode);
      if (!id) errors.push(`供者 ${donorCode} 不存在`);
      else donorId = id;
    }

    // --- sourceOrg ---
    const sourceOrgName = (raw.sourceOrgName ?? "").trim();
    let sourceOrgId: string | null = null;
    if (sourceOrgName) {
      const id = ctx.sourceOrgsByName.get(sourceOrgName);
      if (!id) errors.push(`来源单位 ${sourceOrgName} 不存在`);
      else sourceOrgId = id;
    }

    // --- parent sample ---
    const parentCode = (raw.parentSampleCode ?? "").trim();
    let parentSampleId: string | null = null;
    if (parentCode) {
      const id = ctx.parentByCode.get(parentCode);
      if (!id) errors.push(`母样本 ${parentCode} 不存在`);
      else parentSampleId = id;
    }

    // --- location path ---
    const locationPath = (raw.locationPath ?? "").trim();
    let locationId: string | null = null;
    let pendingSlot: ImportResolved["pendingSlot"] = null;
    if (!locationPath) {
      errors.push("locationPath 不能为空");
    } else {
      const parts = locationPath.split(">").map((p) => p.trim()).filter(Boolean);
      if (parts.length < 4) {
        errors.push(
          `locationPath 必须包含罐 > 提筒 > 盒 > 孔 4 级，当前只有 ${parts.length} 级`,
        );
      } else {
        const fullKey = pathKey(parts);
        const existing = ctx.locationsByPath.get(fullKey);
        if (existing) {
          locationId = existing.id;
          if (ctx.occupiedSlotIds.has(existing.id) || inFlightSlots.has(existing.id)) {
            errors.push(`位置 ${locationPath} 已被占用`);
          } else {
            inFlightSlots.add(existing.id);
          }
        } else {
          // Maybe last segment is a grid cell; try to resolve the BOX.
          const boxKey = pathKey(parts.slice(0, 3));
          const box = ctx.locationsByPath.get(boxKey);
          if (!box || box.level !== "BOX") {
            errors.push(`位置 ${locationPath} 找不到对应的冻存盒`);
          } else {
            const cell = parts[3];
            const pos = parseCellLabel(cell, box.gridCols ?? 10);
            if (pos == null || (box.capacity != null && pos >= box.capacity)) {
              errors.push(
                `位置 ${locationPath} 的孔位 "${cell}" 不符合该冻存盒规格`,
              );
            } else {
              const inflightKey = `${box.id}|${pos}`;
              if (inFlightPendingPositions.has(inflightKey)) {
                errors.push(`位置 ${locationPath} 在本次导入中重复`);
              } else {
                pendingSlot = { boxId: box.id, position: pos, cellLabel: cell };
                inFlightPendingPositions.add(inflightKey);
                warnings.push(`孔位 ${cell} 不存在，导入时将自动创建`);
              }
            }
          }
        }
      }
    }

    // --- volume ---
    const volume = asNum(raw.volume ?? "");
    const volumeUnit = (raw.volumeUnit ?? "").trim() || null;

    // --- dates ---
    const collectedAt = asDateString(raw.collectedAt ?? "");
    const frozenAt = asDateString(raw.frozenAt ?? "");
    const expireAt = asDateString(raw.expireAt ?? "");
    if ((raw.collectedAt ?? "").trim() && !collectedAt)
      errors.push("collectedAt 日期格式无效");
    if ((raw.frozenAt ?? "").trim() && !frozenAt)
      errors.push("frozenAt 日期格式无效");
    if ((raw.expireAt ?? "").trim() && !expireAt)
      errors.push("expireAt 日期格式无效");

    // --- custom fields ---
    const customFields: Record<string, unknown> = {};
    if (type) {
      for (const field of type.schema) {
        const colName = `cf_${field.key}`;
        const v = (raw[colName] ?? "").trim();
        if (v === "") {
          if (field.required)
            errors.push(`列 ${colName}（${field.label}）不能为空`);
          continue;
        }
        switch (field.type) {
          case "number": {
            const n = Number(v);
            if (!Number.isFinite(n)) {
              errors.push(`列 ${colName}（${field.label}）必须为数字`);
            } else customFields[field.key] = n;
            break;
          }
          case "boolean":
            customFields[field.key] = ["1", "true", "TRUE", "是", "Y"].includes(
              v,
            );
            break;
          case "date": {
            const d = asDateString(v);
            if (!d)
              errors.push(`列 ${colName}（${field.label}）日期格式无效`);
            else customFields[field.key] = d;
            break;
          }
          case "select": {
            if (
              field.options &&
              field.options.length > 0 &&
              !field.options.includes(v)
            ) {
              errors.push(
                `列 ${colName}（${field.label}）必须是 ${field.options.join(" / ")} 之一`,
              );
            } else customFields[field.key] = v;
            break;
          }
          default:
            customFields[field.key] = v;
        }
      }
    }

    const status: ImportRowResult["status"] =
      errors.length > 0 ? "ERROR" : warnings.length > 0 ? "WARNING" : "OK";

    let resolved: ImportResolved | null = null;
    if (errors.length === 0 && project && type && purpose) {
      resolved = {
        projectId: project.id,
        typeId: type.id,
        typeSchema: type.schema,
        sampleCode,
        purpose,
        donorId,
        sourceOrgId,
        parentSampleId,
        locationId,
        pendingSlot,
        volume,
        volumeUnit,
        collectedAt,
        frozenAt,
        expireAt,
        customFields,
        notes: (raw.notes ?? "").trim() || null,
      };
      if (project) {
        const set = inFlightCodes.get(project.id) ?? new Set();
        set.add(sampleCode);
        inFlightCodes.set(project.id, set);
      }
    }

    out.push({ rowIndex, raw, resolved, status, errors, warnings });
  });

  return out;
}

