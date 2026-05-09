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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { discardSampleAction } from "@/server/actions/samples";

export function DiscardDialog({
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
  const [reason, setReason] = React.useState("");
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setReason("");
      setConfirmOpen(false);
    }
  }, [open]);

  function tryConfirm() {
    if (!reason.trim()) {
      toast.error("销毁原因不能为空");
      return;
    }
    setConfirmOpen(true);
  }

  async function doDiscard() {
    if (!sampleId) return;
    setPending(true);
    const result = await discardSampleAction(sampleId, { reason: reason.trim() });
    setPending(false);
    if (result.success) {
      toast.success("已销毁");
      setConfirmOpen(false);
      onOpenChange(false);
    } else {
      toast.error(result.error);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] w-[95vw] max-w-md overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>销毁样本</DialogTitle>
            <DialogDescription>
              {sampleCode ? `样本：${sampleCode}` : ""}
              （状态将变为「已销毁」，且清除位置占用）
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>销毁原因 *</Label>
              <Textarea
                rows={3}
                placeholder="如：超过有效期，活率不足"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
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
            <Button
              type="button"
              variant="destructive"
              onClick={tryConfirm}
              disabled={pending}
            >
              销毁
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="二次确认"
        description={`确认销毁样本「${sampleCode ?? ""}」？此操作不可撤销。`}
        destructive
        loading={pending}
        confirmLabel="确认销毁"
        onConfirm={doDiscard}
      />
    </>
  );
}
