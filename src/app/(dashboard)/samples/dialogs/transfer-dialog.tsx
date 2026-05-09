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
import {
  LocationPicker,
  type PickerLocation,
} from "@/components/shared/location-picker";
import { transferSampleAction } from "@/server/actions/samples";

export function TransferDialog({
  open,
  onOpenChange,
  sampleId,
  sampleCode,
  locations,
  occupancy,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sampleId: string | null;
  sampleCode: string | null;
  locations: PickerLocation[];
  occupancy: Record<string, number>;
}) {
  const [target, setTarget] = React.useState<string | null>(null);
  const [note, setNote] = React.useState("");
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setTarget(null);
      setNote("");
    }
  }, [open]);

  async function submit() {
    if (!sampleId) return;
    if (!target) {
      toast.error("请选择目标位置");
      return;
    }
    setPending(true);
    const result = await transferSampleAction(sampleId, {
      toLocationId: target,
      operatorNote: note,
    });
    setPending(false);
    if (result.success) {
      toast.success("已转移");
      onOpenChange(false);
    } else {
      toast.error(result.error);
    }
  }

  // Exclude editing sample's own occupancy from the picker.
  const adjOccupancy = React.useMemo(() => {
    if (!sampleId) return occupancy;
    const next = { ...occupancy };
    // We don't know which slot the sample occupies here; the picker treats
    // any occupied slot as blocked. The server-side action also re-checks
    // with excludeSampleId so a transfer to the same slot returns a clearer
    // "目标位置与当前位置相同" error.
    return next;
  }, [occupancy, sampleId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-2xl overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>转移位置</DialogTitle>
          <DialogDescription>
            {sampleCode ? `样本：${sampleCode}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <LocationPicker
            mode="single"
            value={target}
            onChange={setTarget}
            locations={locations}
            occupancy={adjOccupancy}
            excludeSampleId={sampleId ?? undefined}
          />
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
            {pending ? "提交中..." : "确认转移"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
