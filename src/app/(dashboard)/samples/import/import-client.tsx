"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, Upload, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  downloadTemplateAction,
  parseImportAction,
  confirmImportAction,
} from "@/server/actions/samples-import";
import type { ImportRowResult } from "@/server/services/excel";

function base64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr.buffer as ArrayBuffer], { type: mime });
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 0);
}

export function ImportClient() {
  const router = useRouter();
  const [downloadingTpl, setDownloadingTpl] = React.useState(false);
  const [parsing, setParsing] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [rows, setRows] = React.useState<ImportRowResult[] | null>(null);

  async function handleDownloadTemplate() {
    setDownloadingTpl(true);
    const result = await downloadTemplateAction();
    setDownloadingTpl(false);
    if (result.success && result.data) {
      const blob = base64ToBlob(
        result.data.base64,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      triggerDownload(blob, result.data.filename);
      toast.success("模板已下载");
    } else if (!result.success) {
      toast.error(result.error);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
    const fd = new FormData();
    fd.append("file", file);
    const result = await parseImportAction(fd);
    setParsing(false);
    if (result.success && result.data) {
      setRows(result.data.rows);
      toast.success(`已解析 ${result.data.rows.length} 行`);
    } else if (!result.success) {
      setRows(null);
      toast.error(result.error);
    }
    // Allow re-uploading the same file.
    e.target.value = "";
  }

  async function handleConfirm() {
    if (!rows) return;
    setImporting(true);
    const result = await confirmImportAction(rows);
    setImporting(false);
    if (result.success && result.data) {
      toast.success(
        `成功导入 ${result.data.created} 个样本（跳过 ${result.data.skipped} 行）`,
      );
      router.push("/samples");
      router.refresh();
    } else if (!result.success) {
      toast.error(result.error);
    }
  }

  const counts = React.useMemo(() => {
    if (!rows) return { ok: 0, warn: 0, err: 0 };
    return rows.reduce(
      (acc, r) => {
        if (r.status === "OK") acc.ok++;
        else if (r.status === "WARNING") acc.warn++;
        else acc.err++;
        return acc;
      },
      { ok: 0, warn: 0, err: 0 },
    );
  }, [rows]);

  const importable = counts.ok + counts.warn;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">第 1 步：下载模板并填写</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            模板包含「样本数据 / 字段说明 / 项目代码对照 / 样本类型对照」4 个 sheet。
            动态字段列以 <code>cf_</code> 开头，列名严格匹配类型 schema 的 key。
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={handleDownloadTemplate}
            disabled={downloadingTpl}
          >
            <Download className="mr-1 h-4 w-4" />
            {downloadingTpl ? "生成中..." : "下载导入模板"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">第 2 步：上传并校验</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="block">
            <input
              type="file"
              accept=".xlsx"
              onChange={handleFileChange}
              disabled={parsing}
              className="block w-full cursor-pointer rounded border bg-background px-3 py-2 text-sm file:mr-3 file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm hover:bg-accent/40"
            />
          </label>
          {parsing && (
            <p className="text-xs text-muted-foreground">正在解析并校验...</p>
          )}
        </CardContent>
      </Card>

      {rows && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">第 3 步：预览与确认</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Badge variant="outline" className="bg-green-100 text-green-700">
                <CheckCircle2 className="mr-1 h-3 w-3" /> 通过 {counts.ok}
              </Badge>
              <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                <AlertTriangle className="mr-1 h-3 w-3" /> 警告 {counts.warn}
              </Badge>
              <Badge variant="outline" className="bg-rose-100 text-rose-700">
                <XCircle className="mr-1 h-3 w-3" /> 错误 {counts.err}
              </Badge>
              <span className="text-xs text-muted-foreground">
                可导入 {importable} 行（含警告会自动创建孔位）
              </span>
              <div className="ml-auto">
                <Button
                  type="button"
                  onClick={handleConfirm}
                  disabled={importing || importable === 0}
                >
                  <Upload className="mr-1 h-4 w-4" />
                  {importing
                    ? "导入中..."
                    : `确认导入 ${importable} 行`}
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">行</TableHead>
                    <TableHead className="w-20">状态</TableHead>
                    <TableHead>样本编号</TableHead>
                    <TableHead>项目</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>位置</TableHead>
                    <TableHead>问题</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 50).map((r) => (
                    <TableRow key={r.rowIndex}>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.rowIndex}
                      </TableCell>
                      <TableCell>
                        {r.status === "OK" && (
                          <Badge
                            variant="outline"
                            className="bg-green-100 text-green-700"
                          >
                            通过
                          </Badge>
                        )}
                        {r.status === "WARNING" && (
                          <Badge
                            variant="outline"
                            className="bg-yellow-100 text-yellow-800"
                          >
                            警告
                          </Badge>
                        )}
                        {r.status === "ERROR" && (
                          <Badge
                            variant="outline"
                            className="bg-rose-100 text-rose-700"
                          >
                            错误
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {r.raw.sampleCode ?? ""}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.raw.projectCode ?? ""}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.raw.typeCode ?? ""}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground" title={r.raw.locationPath}>
                        {r.raw.locationPath ?? ""}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.errors.length > 0 && (
                          <ul className="list-disc pl-4 text-rose-600">
                            {r.errors.map((e, i) => (
                              <li key={i}>{e}</li>
                            ))}
                          </ul>
                        )}
                        {r.warnings.length > 0 && (
                          <ul className="list-disc pl-4 text-yellow-700">
                            {r.warnings.map((w, i) => (
                              <li key={i}>{w}</li>
                            ))}
                          </ul>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {rows.length > 50 && (
                <p className="border-t p-2 text-center text-xs text-muted-foreground">
                  仅显示前 50 行预览
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
