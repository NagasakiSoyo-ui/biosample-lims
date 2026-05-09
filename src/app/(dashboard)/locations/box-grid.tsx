"use client";

import { cn } from "@/lib/utils";
import { cellLabel } from "@/server/services/locations";
import type { LocationNode } from "./locations-shell";

export function BoxGrid({
  rows,
  cols,
  slots,
  onCreateAt,
  onSelectSlot,
}: {
  rows: number;
  cols: number;
  slots: LocationNode[];
  // Called when a user clicks an empty cell. If undefined, empty cells are
  // non-interactive (e.g. when the BOX is disabled).
  onCreateAt?: (position: number) => void;
  // Called when a user clicks an allocated cell — selects that SLOT in the
  // tree.
  onSelectSlot?: (id: string) => void;
}) {
  const total = rows * cols;

  // Index SLOT children by position. Anything else (orphan SLOT without
  // position) is ignored by the grid — it'll still appear in the children
  // table above.
  const slotByPos = new Map<number, LocationNode>();
  for (const s of slots) {
    if (s.level === "SLOT" && s.position != null) {
      slotByPos.set(s.position, s);
    }
  }

  const allocated = slotByPos.size;
  const occupied = Array.from(slotByPos.values()).filter(
    (s) => s.sampleCount > 0,
  ).length;

  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">
        {rows} × {cols} 共 {total} 格 · 已分配 {allocated} · 含样本 {occupied}
      </div>
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: total }).map((_, pos) => {
          const label = cellLabel(pos, cols);
          const slot = slotByPos.get(pos);

          if (!slot) {
            return (
              <button
                key={pos}
                type="button"
                disabled={!onCreateAt}
                title={
                  onCreateAt
                    ? `${label}（空闲，点击新增孔位）`
                    : `${label}（空闲）`
                }
                onClick={() => onCreateAt?.(pos)}
                className={cn(
                  "flex aspect-square items-center justify-center rounded border border-dashed border-muted-foreground/30 text-[10px] leading-none text-muted-foreground transition",
                  onCreateAt
                    ? "hover:border-primary hover:bg-primary/10 hover:text-primary"
                    : "cursor-default",
                )}
              >
                {label}
              </button>
            );
          }

          const filled = slot.sampleCount > 0;
          return (
            <button
              key={pos}
              type="button"
              disabled={!onSelectSlot}
              title={
                filled
                  ? `${label} · ${slot.sampleCount} 个样本 · ${slot.name}`
                  : `${label} · 已分配（暂无样本）· ${slot.name}`
              }
              onClick={() => onSelectSlot?.(slot.id)}
              className={cn(
                "flex aspect-square items-center justify-center rounded border text-[10px] font-medium leading-none transition",
                filled
                  ? "border-primary/40 bg-primary/15 text-primary hover:bg-primary/25"
                  : "border-foreground/10 bg-muted text-foreground hover:bg-accent",
                !slot.isActive && "opacity-40",
                !onSelectSlot && "cursor-default",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block size-3 rounded border border-dashed border-muted-foreground/40" />
          空闲
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-3 rounded border border-foreground/10 bg-muted" />
          已分配
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-3 rounded border border-primary/40 bg-primary/15" />
          含样本
        </span>
      </div>
    </div>
  );
}
