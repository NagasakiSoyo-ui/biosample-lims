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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { freezeThawSampleAction } from "@/server/actions/samples";

export function FreezeThawDialog({
  open,
  onOpenChange,
  sampleId,
  sampleCode,
  currentCount,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sampleId: string | null;
  sampleCode: string | null;
  currentCount: number;
}) {
  const [note, setNote] = React.useState("");
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (open) setNote("");
  }, [open]);

  async function submit() {
    if (!sampleId) return;
    setPending(true);
    const result = await freezeThawSampleAction(sampleId, {
      operatorNote: note,
    });
    setPending(false);
    if (result.success) {
      toast.success(`已记录第 ${result.data?.newCount} 次冻融`);
      onOpenChange(false);
    } else {
      toast.error(result.error);
    }
  }

  const willBe = currentCount + 1;
  const isHigh = currentCount >= 5;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-md overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>记录冻融</DialogTitle>
          <DialogDescription>
            {sampleCode ? `样本：${sampleCode}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <span className="text-muted-foreground">当前冻融次数：</span>
            <span className="font-medium">{currentCount}</span>
            <span className="mx-2 text-muted-foreground">→</span>
            <span className="font-semibold">{willBe}</span>
          </div>

          {isHigh && (
            <Alert variant="destructive">
              <AlertTitle>冻融次数较高</AlertTitle>
              <AlertDescription>
                该样本已冻融 {currentCount} 次。频繁冻融会损害细胞活性，请谨慎。
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label>操作备注</Label>
            <Textarea
              rows={2}
              placeholder="例：取出做流式后放回"
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
            {pending ? "提交中..." : "确认冻融"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
