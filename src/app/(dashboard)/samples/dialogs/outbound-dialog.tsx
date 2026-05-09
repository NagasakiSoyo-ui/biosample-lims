"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { outboundSampleAction } from "@/server/actions/samples";

const REASONS = [
  "实验消耗",
  "临床回输",
  "质检送出",
  "转移机构",
  "其他",
] as const;

export function OutboundDialog({
  open,
  onOpenChange,
  sampleId,
  sampleCode,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sampleId: string | null;
  sampleCode: string | null;
}) {
  const [reason, setReason] = React.useState<string>("实验消耗");
  const [customReason, setCustomReason] = React.useState("");
  const [quantity, setQuantity] = React.useState("");
  const [newStatus, setNewStatus] = React.useState<
    "IN_USE" | "DEPLETED" | "RELEASED"
  >("IN_USE");
  const [note, setNote] = React.useState("");
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setReason("实验消耗");
      setCustomReason("");
      setQuantity("");
      setNewStatus("IN_USE");
      setNote("");
    }
  }, [open]);

  async function submit() {
    if (!sampleId) return;
    const finalReason = reason === "其他" ? customReason.trim() : reason;
    if (!finalReason) {
      toast.error("请填写出库原因");
      return;
    }
    let qty: number | null = null;
    if (quantity.trim() !== "") {
      const n = Number(quantity);
      if (!Number.isFinite(n) || n < 0) {
        toast.error("出库数量必须为非负数");
        return;
      }
      qty = n;
    }
    setPending(true);
    const result = await outboundSampleAction(sampleId, {
      reason: finalReason,
      quantityChange: qty,
      newStatus,
      operatorNote: note,
    });
    setPending(false);
    if (result.success) {
      toast.success("已出库");
      onOpenChange(false);
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-md overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>样本出库</DialogTitle>
          <DialogDescription>
            {sampleCode ? `样本：${sampleCode}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>出库原因 *</Label>
            <Select
              value={reason}
              onValueChange={(v) => setReason(v ?? "")}
              items={Object.fromEntries(REASONS.map((r) => [r, r]))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {reason === "其他" && (
              <Input
                placeholder="请填写自定义原因"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
              />
            )}
          </div>

          <div className="space-y-2">
            <Label>出库数量（可空）</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              placeholder="如 1.5 (mL)"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>出库后状态 *</Label>
            <Select
              value={newStatus}
              onValueChange={(v) =>
                setNewStatus((v ?? "IN_USE") as typeof newStatus)
              }
              items={{
                IN_USE: "使用中",
                DEPLETED: "已用完",
                RELEASED: "已放行",
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="IN_USE">使用中</SelectItem>
                <SelectItem value="DEPLETED">已用完</SelectItem>
                <SelectItem value="RELEASED">已放行</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              「已用完」「已放行」会清除位置占用
            </p>
          </div>

          <div className="space-y-2">
            <Label>操作备注</Label>
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button type="button" onClick={submit} disabled={pending}>
            {pending ? "提交中..." : "确认出库"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
