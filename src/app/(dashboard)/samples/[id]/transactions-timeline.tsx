import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import {
  TX_TYPE_LABEL,
  SAMPLE_STATUS_LABEL,
} from "@/server/services/samples";
import type { TransactionType, SampleStatus } from "@prisma/client";

export type TimelineRow = {
  id: string;
  type: TransactionType;
  createdAt: Date;
  operatorName: string;
  fromLocationPath: string | null;
  toLocationPath: string | null;
  previousStatus: SampleStatus | null;
  newStatus: SampleStatus | null;
  reason: string | null;
  operatorNote: string | null;
  quantityChange: number | null;
};

const TX_VARIANT: Record<TransactionType, string> = {
  INBOUND: "bg-green-100 text-green-700 border-green-200",
  OUTBOUND: "bg-blue-100 text-blue-700 border-blue-200",
  MOVE: "bg-purple-100 text-purple-700 border-purple-200",
  FREEZE_THAW: "bg-cyan-100 text-cyan-700 border-cyan-200",
  STATUS_CHANGE: "bg-yellow-100 text-yellow-800 border-yellow-200",
  DISCARD: "bg-rose-100 text-rose-700 border-rose-200",
};

export function TransactionsTimeline({ rows }: { rows: TimelineRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded border border-dashed p-6 text-center text-sm text-muted-foreground">
        暂无出入库记录
      </p>
    );
  }
  return (
    <ol className="relative space-y-4 border-l border-border pl-6">
      {rows.map((row) => (
        <li key={row.id} className="relative">
          <span className="absolute -left-[7px] top-2 inline-block size-3 rounded-full border bg-background" />
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="outline" className={TX_VARIANT[row.type]}>
              {TX_TYPE_LABEL[row.type]}
            </Badge>
            <span className="text-muted-foreground">
              {formatDateTime(row.createdAt)}
            </span>
            <span className="text-muted-foreground">·</span>
            <span>{row.operatorName}</span>
          </div>
          <dl className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            {(row.fromLocationPath || row.toLocationPath) && (
              <div>
                <span>位置：</span>
                <span className="text-foreground">
                  {row.fromLocationPath ?? "—"} → {row.toLocationPath ?? "—"}
                </span>
              </div>
            )}
            {(row.previousStatus || row.newStatus) && (
              <div>
                <span>状态：</span>
                <span className="text-foreground">
                  {row.previousStatus
                    ? SAMPLE_STATUS_LABEL[row.previousStatus]
                    : "—"}{" "}
                  →{" "}
                  {row.newStatus
                    ? SAMPLE_STATUS_LABEL[row.newStatus]
                    : "—"}
                </span>
              </div>
            )}
            {row.quantityChange != null && (
              <div>
                <span>消耗量：</span>
                <span className="text-foreground">{row.quantityChange}</span>
              </div>
            )}
            {row.reason && (
              <div>
                <span>原因：</span>
                <span className="text-foreground">{row.reason}</span>
              </div>
            )}
            {row.operatorNote && (
              <div>
                <span>备注：</span>
                <span className="text-foreground">{row.operatorNote}</span>
              </div>
            )}
          </dl>
        </li>
      ))}
    </ol>
  );
}
