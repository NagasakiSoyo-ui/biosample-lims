"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  toggleLocationActiveAction,
  deleteLocationAction,
} from "@/server/actions/locations";
import { cellLabel } from "@/server/services/locations";
import type { LocationLevel } from "@prisma/client";
import { LocationTree } from "./location-tree";
import { LocationDetailPanel } from "./location-detail-panel";
import {
  LocationFormDialog,
  type LocationFormMode,
} from "./location-form-dialog";

export type LocationNode = {
  id: string;
  name: string;
  code: string | null;
  level: LocationLevel;
  parentId: string | null;
  capacity: number | null;
  gridRows: number | null;
  gridCols: number | null;
  position: number | null;
  notes: string | null;
  isActive: boolean;
  sampleCount: number;
  childCount: number;
};

export type TreeNode = LocationNode & { children: TreeNode[] };

function buildTree(items: LocationNode[]): TreeNode[] {
  const byParent = new Map<string | null, LocationNode[]>();
  for (const it of items) {
    const list = byParent.get(it.parentId) ?? [];
    list.push(it);
    byParent.set(it.parentId, list);
  }
  function attach(parentId: string | null): TreeNode[] {
    return (byParent.get(parentId) ?? []).map((n) => ({
      ...n,
      children: attach(n.id),
    }));
  }
  return attach(null);
}

export function LocationsShell({ items }: { items: LocationNode[] }) {
  const [selectedId, setSelectedId] = React.useState<string | null>(
    items[0]?.id ?? null,
  );
  const [formOpen, setFormOpen] = React.useState(false);
  const [formMode, setFormMode] = React.useState<LocationFormMode | null>(null);
  const [confirm, setConfirm] = React.useState<
    | { kind: "toggle"; node: LocationNode }
    | { kind: "delete"; node: LocationNode }
    | null
  >(null);
  const [pending, setPending] = React.useState(false);

  const tree = React.useMemo(() => buildTree(items), [items]);
  const byId = React.useMemo(() => {
    const m = new Map<string, LocationNode>();
    for (const it of items) m.set(it.id, it);
    return m;
  }, [items]);
  const selected = selectedId ? (byId.get(selectedId) ?? null) : null;
  const children: LocationNode[] = React.useMemo(
    () => (selected ? items.filter((i) => i.parentId === selected.id) : []),
    [items, selected],
  );

  React.useEffect(() => {
    if (selectedId && !byId.has(selectedId)) {
      setSelectedId(null);
    }
  }, [byId, selectedId]);

  function openCreateTopLevel() {
    setFormMode({ mode: "create", parentId: null, parentLevel: null });
    setFormOpen(true);
  }
  function openCreateChild() {
    if (!selected) return;
    setFormMode({
      mode: "create",
      parentId: selected.id,
      parentLevel: selected.level,
    });
    setFormOpen(true);
  }
  function openCreateSlotAt(position: number) {
    if (!selected || selected.level !== "BOX") return;
    const cols = selected.gridCols ?? 10;
    setFormMode({
      mode: "create",
      parentId: selected.id,
      parentLevel: "BOX",
      position,
      defaultName: cellLabel(position, cols),
    });
    setFormOpen(true);
  }
  function openEdit() {
    if (!selected) return;
    setFormMode({ mode: "edit", node: selected });
    setFormOpen(true);
  }

  async function doConfirm() {
    if (!confirm) return;
    setPending(true);
    if (confirm.kind === "toggle") {
      const result = await toggleLocationActiveAction(confirm.node.id);
      setPending(false);
      if (result.success) {
        toast.success(confirm.node.isActive ? "已禁用" : "已启用");
        setConfirm(null);
      } else {
        toast.error(result.error);
      }
    } else {
      const result = await deleteLocationAction(confirm.node.id);
      setPending(false);
      if (result.success) {
        toast.success("已删除");
        setConfirm(null);
        if (selectedId === confirm.node.id) setSelectedId(null);
      } else {
        toast.error(result.error);
      }
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-[320px_1fr]">
      <Card className="md:sticky md:top-4 md:max-h-[calc(100vh-8rem)]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">位置树</CardTitle>
            <Button size="sm" onClick={openCreateTopLevel}>
              <Plus className="mr-1 h-4 w-4" />
              新增罐/冰箱
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-auto">
          {tree.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              暂无位置，点击右上角「新增罐/冰箱」开始
            </p>
          ) : (
            <LocationTree
              nodes={tree}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          )}
        </CardContent>
      </Card>

      <div>
        {selected ? (
          <LocationDetailPanel
            node={selected}
            children={children}
            onEdit={openEdit}
            onCreateChild={openCreateChild}
            onCreateSlotAt={openCreateSlotAt}
            onToggleActive={() => setConfirm({ kind: "toggle", node: selected })}
            onDelete={() => setConfirm({ kind: "delete", node: selected })}
            onSelectChild={setSelectedId}
          />
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              从左侧选择一个节点查看详情
            </CardContent>
          </Card>
        )}
      </div>

      <LocationFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
      />

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(v) => !v && setConfirm(null)}
        title={
          confirm?.kind === "delete"
            ? "确认删除"
            : confirm?.node.isActive
              ? "确认禁用"
              : "确认启用"
        }
        description={
          confirm?.kind === "delete"
            ? `将永久删除节点「${confirm.node.name}」。如其下还有子节点或样本，删除会失败。`
            : confirm?.node.isActive
              ? `禁用节点「${confirm.node.name}」后，该位置及其下未使用的孔位将不可用于新样本。`
              : `重新启用节点「${confirm?.node.name}」。`
        }
        destructive={
          confirm?.kind === "delete" ||
          (confirm?.kind === "toggle" && confirm.node.isActive)
        }
        loading={pending}
        confirmLabel={
          confirm?.kind === "delete"
            ? "删除"
            : confirm?.node.isActive
              ? "禁用"
              : "启用"
        }
        onConfirm={doConfirm}
      />
    </div>
  );
}
