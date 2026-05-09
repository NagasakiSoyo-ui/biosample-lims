"use server";

import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { getActor } from "@/server/services/auth-guard";
import {
  actionLabel,
  AUDIT_ENTITY_LABEL,
} from "@/lib/audit-action-labels";
import { formatDateTime } from "@/lib/format";
import type { ActionResult } from "@/types/action";

export type AuditExportRow = {
  createdAt: Date;
  userName: string | null;
  userEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  ipAddress: string | null;
  changes: unknown;
};

export async function exportAuditLogsAction(
  rows: AuditExportRow[],
): Promise<ActionResult<{ filename: string; base64: string }>> {
  const actor = await getActor();
  if (!actor) return { success: false, error: "未登录" };
  if (actor.role !== "ADMIN") return { success: false, error: "无权限" };

  if (rows.length === 0) {
    return { success: false, error: "无可导出的记录" };
  }

  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("审计日志");
  sheet.addRow([
    "时间",
    "用户",
    "邮箱",
    "动作",
    "实体类型",
    "实体 ID",
    "IP",
    "变更详情",
  ]);
  sheet.getRow(1).font = { bold: true };
  for (const r of rows) {
    sheet.addRow([
      formatDateTime(r.createdAt),
      r.userName ?? "（已删除用户）",
      r.userEmail ?? "—",
      actionLabel(r.action),
      AUDIT_ENTITY_LABEL[r.entityType] ?? r.entityType,
      r.entityId ?? "—",
      r.ipAddress ?? "—",
      r.changes ? JSON.stringify(r.changes) : "",
    ]);
  }
  sheet.columns.forEach((c, i) => {
    c.width = i === 7 ? 60 : 18;
  });

  const buf = await wb.xlsx.writeBuffer();
  const out = Buffer.isBuffer(buf) ? buf : Buffer.from(buf as ArrayBuffer);
  return {
    success: true,
    data: {
      filename: `audit-logs-${Date.now()}.xlsx`,
      base64: out.toString("base64"),
    },
  };
}
