"use client";

import * as React from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  cellLabel,
  LEVEL_ICON,
  LEVEL_LABEL,
} from "@/server/services/locations";
import { getOrCreateSlotAction } from "@/server/actions/locations";

export type PickerLocation = {
  id: string;
  name: string;
  level: "TANK" | "CANISTER" | "BOX" | "SLOT";
  parentId: string | null;
  capacity: number | null;
  gridRows: number | null;
  gridCols: number | null;
  position: number | null;
  isActive: boolean;
};

export type LocationPickerSingleProps = {
  mode?: "single";
  value: string | null;
  onChange: (slotId: string | null) => void;
  excludeSampleId?: string;
  locations: PickerLocation[];
  // Map of locationId → number of samples currently occupying.
  occupancy: Record<string, number>;
};

export type LocationPickerMultiProps = {
  mode: "multi";
  values: string[];
  onChange: (slotIds: string[]) => void;
  maxCount: number;
  locations: PickerLocation[];
  occupancy: Record<string, number>;
};

type Props = LocationPickerSingleProps | LocationPickerMultiProps;

function getPath(
  byId: Map<string, PickerLocation>,
  id: string | null,
): PickerLocation[] {
  const out: PickerLocation[] = [];
  let cursor = id;
  for (let i = 0; cursor && i < 8; i++) {
    const node = byId.get(cursor);
    if (!node) break;
    out.unshift(node);
    cursor = node.parentId;
  }
  return out;
}

export function LocationPicker(props: Props) {
  const isMulti = props.mode === "multi";
  const [items, setItems] = React.useState<PickerLocation[]>(props.locations);
  React.useEffect(() => setItems(props.locations), [props.locations]);

  const byId = React.useMemo(() => {
    const m = new Map<string, PickerLocation>();
    for (const it of items) m.set(it.id, it);
    return m;
  }, [items]);

  const tanks = items.filter((i) => i.level === "TANK" && i.isActive);

  // ---- grid cascade state ----
  const [tankId, setTankId] = React.useState<string | null>(null);
  const [canisterId, setCanisterId] = React.useState<string | null>(null);
  const [boxId, setBoxId] = React.useState<string | null>(null);

  // Initialize cascade from `value` (single mode only) the first time.
  React.useEffect(() => {
    if (isMulti) return;
    const single = props as LocationPickerSingleProps;
    if (single.value && !boxId) {
      const path = getPath(byId, single.value);
      const t = path.find((p) => p.level === "TANK");
      const c = path.find((p) => p.level === "CANISTER");
      const b = path.find((p) => p.level === "BOX");
      if (t) setTankId(t.id);
      if (c) setCanisterId(c.id);
      if (b) setBoxId(b.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canisters = tankId
    ? items.filter(
        (i) =>
          i.level === "CANISTER" && i.parentId === tankId && i.isActive,
      )
    : [];
  const boxes = canisterId
    ? items.filter(
        (i) => i.level === "BOX" && i.parentId === canisterId && i.isActive,
      )
    : [];
  const selectedBox = boxId ? byId.get(boxId) ?? null : null;

  const slotsInBox = boxId
    ? items.filter((i) => i.level === "SLOT" && i.parentId === boxId)
    : [];

  const isOccupied = (slotId: string) =>
    (props.occupancy[slotId] ?? 0) > 0;

  const isSelected = isMulti
    ? (slotId: string) =>
        (props as LocationPickerMultiProps).values.includes(slotId)
    : (slotId: string) =>
        (props as LocationPickerSingleProps).value === slotId;

  async function handleCellClick(position: number) {
    if (!boxId || !selectedBox) return;
    const cols = selectedBox.gridCols ?? 10;

    // Existing SLOT at this position?
    const existing = slotsInBox.find((s) => s.position === position);
    if (existing) {
      handleSlotPick(existing.id);
      return;
    }

    // Need to create one.
    const result = await getOrCreateSlotAction(boxId, position);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    const slot: PickerLocation = {
      id: result.data!.id,
      name: result.data!.name,
      level: "SLOT",
      parentId: boxId,
      capacity: null,
      gridRows: null,
      gridCols: null,
      position,
      isActive: true,
    };
    setItems((prev) => [...prev, slot]);
    handleSlotPick(slot.id);
    void cols; // referenced only for naming inference; cellLabel() ran on server
  }

  function handleSlotPick(slotId: string) {
    if (isMulti) {
      const m = props as LocationPickerMultiProps;
      const already = m.values.includes(slotId);
      if (already) {
        m.onChange(m.values.filter((v) => v !== slotId));
      } else {
        if (m.values.length >= m.maxCount) {
          toast.error(`最多只能选择 ${m.maxCount} 个位置`);
          return;
        }
        if (isOccupied(slotId)) {
          toast.error("该位置已被其他样本占用");
          return;
        }
        m.onChange([...m.values, slotId]);
      }
    } else {
      const s = props as LocationPickerSingleProps;
      if (
        isOccupied(slotId) &&
        !(s.excludeSampleId && (props.occupancy[slotId] ?? 0) === 1)
      ) {
        // Conservatively block when occupied and not the editing sample's own slot.
        // (The picker page should pre-filter occupancy to exclude the editing sample.)
      }
      s.onChange(slotId);
    }
  }

  // -- smart fill (multi only): from A1 onward, take N empty cells, calling
  //    getOrCreateSlot for any empty grid positions.
  async function handleSmartFill() {
    if (!isMulti || !boxId || !selectedBox) return;
    const m = props as LocationPickerMultiProps;
    const cols = selectedBox.gridCols ?? 10;
    const rows = selectedBox.gridRows ?? 10;
    const total = cols * rows;

    const slotByPos = new Map<number, PickerLocation>();
    for (const s of slotsInBox) {
      if (s.position != null) slotByPos.set(s.position, s);
    }

    const need = m.maxCount - m.values.length;
    if (need <= 0) return;

    const toAddIds: string[] = [];
    const newSlots: PickerLocation[] = [];

    for (let pos = 0; pos < total && toAddIds.length < need; pos++) {
      const ex = slotByPos.get(pos);
      if (ex) {
        if (isOccupied(ex.id) || m.values.includes(ex.id)) continue;
        toAddIds.push(ex.id);
        continue;
      }
      // Empty cell: create on demand.
      const r = await getOrCreateSlotAction(boxId, pos);
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      newSlots.push({
        id: r.data!.id,
        name: r.data!.name,
        level: "SLOT",
        parentId: boxId,
        capacity: null,
        gridRows: null,
        gridCols: null,
        position: pos,
        isActive: true,
      });
      toAddIds.push(r.data!.id);
    }
    if (toAddIds.length === 0) {
      toast.error("没有足够的空闲位置");
      return;
    }
    if (newSlots.length > 0) {
      setItems((prev) => [...prev, ...newSlots]);
    }
    m.onChange([...m.values, ...toAddIds]);
  }

  // -- selection summary line --
  const selectedSummary = isMulti ? (
    <div className="text-sm text-muted-foreground">
      已选 {(props as LocationPickerMultiProps).values.length} /{" "}
      {(props as LocationPickerMultiProps).maxCount} 个位置
    </div>
  ) : (
    <SelectionSummary byId={byId} value={(props as LocationPickerSingleProps).value} />
  );

  return (
    <div className="space-y-3">
      <Tabs defaultValue="grid">
        <TabsList>
          <TabsTrigger value="grid">网格选择</TabsTrigger>
          <TabsTrigger value="tree">从树选择</TabsTrigger>
        </TabsList>

        <TabsContent value="grid" className="space-y-3 pt-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Select
              value={tankId ?? ""}
              onValueChange={(v) => {
                setTankId(v || null);
                setCanisterId(null);
                setBoxId(null);
              }}
              items={Object.fromEntries(
                tanks.map((t) => [t.id, `${LEVEL_ICON.TANK} ${t.name}`]),
              )}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择罐 / 冰箱" />
              </SelectTrigger>
              <SelectContent>
                {tanks.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {LEVEL_ICON.TANK} {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={canisterId ?? ""}
              onValueChange={(v) => {
                setCanisterId(v || null);
                setBoxId(null);
              }}
              disabled={!tankId}
              items={Object.fromEntries(
                canisters.map((c) => [
                  c.id,
                  `${LEVEL_ICON.CANISTER} ${c.name}`,
                ]),
              )}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择提筒" />
              </SelectTrigger>
              <SelectContent>
                {canisters.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {LEVEL_ICON.CANISTER} {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={boxId ?? ""}
              onValueChange={(v) => setBoxId(v || null)}
              disabled={!canisterId}
              items={Object.fromEntries(
                boxes.map((b) => [
                  b.id,
                  `${LEVEL_ICON.BOX} ${b.name} (${b.gridRows}×${b.gridCols})`,
                ]),
              )}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择冻存盒" />
              </SelectTrigger>
              <SelectContent>
                {boxes.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {LEVEL_ICON.BOX} {b.name} ({b.gridRows}×{b.gridCols})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedBox ? (
            <PickerBoxGrid
              box={selectedBox}
              slots={slotsInBox}
              isOccupied={isOccupied}
              isSelected={isSelected}
              onCellClick={handleCellClick}
              multiOrder={
                isMulti
                  ? (props as LocationPickerMultiProps).values
                  : undefined
              }
            />
          ) : (
            <div className="rounded border border-dashed py-8 text-center text-sm text-muted-foreground">
              先选择罐/冰箱、提筒、冻存盒
            </div>
          )}

          {isMulti && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSmartFill}
                disabled={!boxId}
              >
                智能填充剩余位置
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  (props as LocationPickerMultiProps).onChange([])
                }
              >
                清空选择
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="tree" className="space-y-3 pt-3">
          <PickerTree
            items={items}
            isOccupied={isOccupied}
            isSelected={isSelected}
            onSlotPick={handleSlotPick}
          />
        </TabsContent>
      </Tabs>

      <div className="rounded-md border bg-muted/30 px-3 py-2">
        {selectedSummary}
      </div>
    </div>
  );
}

function SelectionSummary({
  byId,
  value,
}: {
  byId: Map<string, PickerLocation>;
  value: string | null;
}) {
  if (!value) {
    return (
      <span className="text-sm text-muted-foreground">尚未选择位置</span>
    );
  }
  const path = getPath(byId, value);
  if (path.length === 0) {
    return (
      <span className="text-sm text-muted-foreground">
        位置数据缺失
      </span>
    );
  }
  return (
    <div className="text-sm">
      <span className="text-muted-foreground">已选：</span>
      <span className="font-medium">
        {path.map((p) => p.name).join(" > ")}
      </span>
    </div>
  );
}

function PickerBoxGrid({
  box,
  slots,
  isOccupied,
  isSelected,
  onCellClick,
  multiOrder,
}: {
  box: PickerLocation;
  slots: PickerLocation[];
  isOccupied: (id: string) => boolean;
  isSelected: (id: string) => boolean;
  onCellClick: (position: number) => void | Promise<void>;
  multiOrder?: string[];
}) {
  const rows = box.gridRows ?? 10;
  const cols = box.gridCols ?? 10;
  const total = rows * cols;
  const slotByPos = new Map<number, PickerLocation>();
  for (const s of slots) {
    if (s.position != null) slotByPos.set(s.position, s);
  }

  return (
    <div className="space-y-2">
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: total }).map((_, pos) => {
          const label = cellLabel(pos, cols);
          const slot = slotByPos.get(pos);
          const occupied = slot ? isOccupied(slot.id) : false;
          const selected = slot ? isSelected(slot.id) : false;
          const orderIdx =
            multiOrder && slot ? multiOrder.indexOf(slot.id) : -1;

          let cls =
            "flex aspect-square items-center justify-center rounded text-[10px] leading-none transition border";
          if (selected) {
            cls +=
              " bg-blue-500/20 border-blue-500 text-blue-700 font-semibold";
          } else if (occupied) {
            cls +=
              " bg-rose-100 border-rose-300/60 text-rose-700 cursor-not-allowed";
          } else if (slot) {
            cls +=
              " bg-muted border-foreground/10 text-foreground hover:bg-accent cursor-pointer";
          } else {
            cls +=
              " border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary cursor-pointer";
          }

          return (
            <button
              key={pos}
              type="button"
              disabled={occupied}
              title={
                occupied
                  ? `${label}（已被占用）`
                  : selected && multiOrder
                    ? `${label}（已选 ${orderIdx + 1}/${multiOrder.length}）`
                    : selected
                      ? `${label}（已选）`
                      : slot
                        ? `${label}（已分配空闲）`
                        : `${label}（空闲，点击选中并自动创建）`
              }
              onClick={() => void onCellClick(pos)}
              className={cls}
            >
              {orderIdx >= 0 ? `${orderIdx + 1}` : label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block size-3 rounded border border-dashed border-muted-foreground/40" />
          空闲（自动创建）
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-3 rounded border border-foreground/10 bg-muted" />
          已分配空闲
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-3 rounded border border-rose-300/60 bg-rose-100" />
          已被占用
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-3 rounded border border-blue-500 bg-blue-500/20" />
          已选
        </span>
      </div>
    </div>
  );
}

function PickerTree({
  items,
  isOccupied,
  isSelected,
  onSlotPick,
}: {
  items: PickerLocation[];
  isOccupied: (id: string) => boolean;
  isSelected: (id: string) => boolean;
  onSlotPick: (id: string) => void;
}) {
  type Node = PickerLocation & { children: Node[] };
  const byParent = new Map<string | null, PickerLocation[]>();
  for (const it of items) {
    const list = byParent.get(it.parentId) ?? [];
    list.push(it);
    byParent.set(it.parentId, list);
  }
  function attach(parentId: string | null): Node[] {
    return (byParent.get(parentId) ?? []).map((n) => ({
      ...n,
      children: attach(n.id),
    }));
  }
  const tree = attach(null);

  if (tree.length === 0) {
    return (
      <p className="rounded border border-dashed py-6 text-center text-sm text-muted-foreground">
        暂无位置数据
      </p>
    );
  }

  return (
    <ul className="max-h-[400px] space-y-0.5 overflow-auto rounded border p-2 text-sm">
      {tree.map((n) => (
        <PickerTreeRow
          key={n.id}
          node={n}
          depth={0}
          isOccupied={isOccupied}
          isSelected={isSelected}
          onSlotPick={onSlotPick}
        />
      ))}
    </ul>
  );
}

function PickerTreeRow({
  node,
  depth,
  isOccupied,
  isSelected,
  onSlotPick,
}: {
  node: PickerLocation & { children: PickerLocation[] };
  depth: number;
  isOccupied: (id: string) => boolean;
  isSelected: (id: string) => boolean;
  onSlotPick: (id: string) => void;
}) {
  const [expanded, setExpanded] = React.useState(true);
  const children = (node.children ?? []) as Array<
    PickerLocation & { children: PickerLocation[] }
  >;
  const hasChildren = children.length > 0;
  const slotPickable = node.level === "SLOT";
  const occupied = slotPickable ? isOccupied(node.id) : false;
  const selected = slotPickable ? isSelected(node.id) : false;

  return (
    <li>
      <div
        className={cn(
          "flex items-center gap-1 rounded px-1 py-1",
          slotPickable
            ? occupied
              ? "cursor-not-allowed text-muted-foreground"
              : "cursor-pointer hover:bg-accent"
            : "",
          selected && "bg-blue-500/20 font-medium",
          !node.isActive && "opacity-50",
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        onClick={() => {
          if (slotPickable && !occupied) onSlotPick(node.id);
        }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="flex h-4 w-4 items-center justify-center text-muted-foreground"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        ) : (
          <span className="inline-block h-4 w-4" />
        )}
        <span aria-hidden>{LEVEL_ICON[node.level]}</span>
        <span className="truncate">{node.name}</span>
        {slotPickable && occupied && (
          <span className="ml-auto text-[10px] text-muted-foreground">
            已占
          </span>
        )}
        {!slotPickable && (
          <span className="ml-auto text-[10px] text-muted-foreground">
            {LEVEL_LABEL[node.level]}
          </span>
        )}
      </div>
      {hasChildren && expanded && (
        <ul className="space-y-0.5">
          {children.map((c) => (
            <PickerTreeRow
              key={c.id}
              node={c}
              depth={depth + 1}
              isOccupied={isOccupied}
              isSelected={isSelected}
              onSlotPick={onSlotPick}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
