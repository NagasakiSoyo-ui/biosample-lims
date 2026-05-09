"use client";

import { Pencil, Plus, Power, PowerOff, Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  LEVEL_ICON,
  LEVEL_LABEL,
  cellLabel,
  childLevelOf,
} from "@/server/services/locations";
import { BoxGrid } from "./box-grid";
import type { LocationNode } from "./locations-shell";

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-2 text-sm">
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <span className="flex-1">{value ?? "—"}</span>
    </div>
  );
}

export function LocationDetailPanel({
  node,
  children,
  onEdit,
  onCreateChild,
  onCreateSlotAt,
  onToggleActive,
  onDelete,
  onSelectChild,
}: {
  node: LocationNode;
  children: LocationNode[];
  onEdit: () => void;
  onCreateChild: () => void;
  onCreateSlotAt: (position: number) => void;
  onToggleActive: () => void;
  onDelete: () => void;
  onSelectChild: (id: string) => void;
}) {
  const childLevel = childLevelOf(node.level);
  const isBox = node.level === "BOX";
  const isSlot = node.level === "SLOT";

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <span aria-hidden>{LEVEL_ICON[node.level]}</span>
              <span>{node.name}</span>
              {!node.isActive && <Badge variant="secondary">已禁用</Badge>}
            </CardTitle>
            <CardDescription>
              {LEVEL_LABEL[node.level]}
              {node.code && ` · ${node.code}`}
              {isSlot &&
                node.position != null &&
                ` · 位置 ${cellLabelFromParent(node, children)}`}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-1">
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="mr-1 h-3.5 w-3.5" />
              编辑
            </Button>
            {!isBox && (
              <Button
                variant="outline"
                size="sm"
                onClick={onCreateChild}
                disabled={!childLevel}
                title={!childLevel ? "孔位下不能再添加子节点" : undefined}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                {childLevel ? `新增${LEVEL_LABEL[childLevel]}` : "新增子节点"}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onToggleActive}>
              {node.isActive ? (
                <>
                  <PowerOff className="mr-1 h-3.5 w-3.5" />
                  禁用
                </>
              ) : (
                <>
                  <Power className="mr-1 h-3.5 w-3.5" />
                  启用
                </>
              )}
            </Button>
            <Button variant="ghost" size="sm" onClick={onDelete}>
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              删除
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1">
          <DetailRow label="名称" value={node.name} />
          <DetailRow label="编码" value={node.code} />
          <DetailRow label="层级" value={LEVEL_LABEL[node.level]} />
          {isBox && (
            <>
              <DetailRow
                label="规格"
                value={`${node.gridRows ?? "?"} × ${node.gridCols ?? "?"}（共 ${node.capacity ?? "?"} 格）`}
              />
              <DetailRow
                label="占用"
                value={`${node.sampleCount} / ${node.capacity ?? "?"}`}
              />
            </>
          )}
          {isSlot && node.position != null && (
            <DetailRow
              label="位置下标"
              value={`#${node.position}`}
            />
          )}
          <DetailRow label="备注" value={node.notes} />
        </div>

        {!isSlot && !isBox && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">
                  子节点{childLevel ? `（${LEVEL_LABEL[childLevel]}）` : ""}
                </h3>
                <span className="text-xs text-muted-foreground">
                  共 {children.length} 个
                </span>
              </div>
              {children.length === 0 ? (
                <p className="rounded border border-dashed p-4 text-center text-sm text-muted-foreground">
                  尚未添加子节点
                </p>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>名称</TableHead>
                        <TableHead>编码</TableHead>
                        <TableHead>容量</TableHead>
                        <TableHead>样本数</TableHead>
                        <TableHead>状态</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {children.map((c) => (
                        <TableRow
                          key={c.id}
                          className="cursor-pointer hover:bg-accent/50"
                          onClick={() => onSelectChild(c.id)}
                        >
                          <TableCell className="font-medium">
                            <span className="mr-1" aria-hidden>
                              {LEVEL_ICON[c.level]}
                            </span>
                            {c.name}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {c.code ?? "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {c.capacity ?? "—"}
                          </TableCell>
                          <TableCell>{c.sampleCount}</TableCell>
                          <TableCell>
                            {c.isActive ? (
                              <Badge>启用</Badge>
                            ) : (
                              <Badge variant="secondary">已禁用</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </>
        )}

        {isBox && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-medium">网格视图</h3>
                <span className="text-xs text-muted-foreground">
                  点击空格新增孔位 · 点击已分配格选中
                </span>
              </div>
              <BoxGrid
                rows={node.gridRows ?? 10}
                cols={node.gridCols ?? 10}
                slots={children}
                onCreateAt={node.isActive ? onCreateSlotAt : undefined}
                onSelectSlot={onSelectChild}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// Helper to display the cell label of a SLOT given its parent BOX context.
// We don't have the parent in this component, so we look it up via children
// (the parent's children) and fall back to the SLOT name.
function cellLabelFromParent(
  slot: LocationNode,
  _siblingsHint: LocationNode[],
): string {
  // We don't actually have the parent BOX's gridCols here; the SLOT's own
  // name has historically been the cell label (set as default when created
  // via the grid). Fall back to position index if name is overridden.
  if (slot.position == null) return slot.name;
  // Best-effort: name is what the user sees and usually equals cellLabel.
  return slot.name;
}
