import type { SampleStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SAMPLE_STATUS_LABEL } from "@/server/services/samples";

const STATUS_CLASS: Record<SampleStatus, string> = {
  AVAILABLE: "bg-green-100 text-green-700 border-green-200",
  IN_USE: "bg-blue-100 text-blue-700 border-blue-200",
  QUARANTINE: "bg-yellow-100 text-yellow-800 border-yellow-200",
  RELEASED: "bg-purple-100 text-purple-700 border-purple-200",
  DEPLETED: "bg-muted text-muted-foreground border-foreground/10",
  DISCARDED: "bg-rose-100 text-rose-700 border-rose-200",
  VOIDED: "bg-rose-50 text-rose-500 border-rose-200 line-through",
};

export function SampleStatusBadge({ status }: { status: SampleStatus }) {
  return (
    <Badge variant="outline" className={cn(STATUS_CLASS[status])}>
      {SAMPLE_STATUS_LABEL[status]}
    </Badge>
  );
}
