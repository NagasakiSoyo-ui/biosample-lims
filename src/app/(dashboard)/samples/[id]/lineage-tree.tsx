"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { SampleStatusBadge } from "@/components/shared/sample-status-badge";
import type { LineageNode } from "@/server/services/samples";

const NODE_W = 140;
const NODE_H = 56;
const GAP_X = 24;
const GAP_Y = 90;

type Pos = { x: number; y: number };

function buildLayout(root: LineageNode): {
  width: number;
  height: number;
  positions: Map<string, Pos>;
  edges: Array<{ from: string; to: string }>;
} {
  const widths = new Map<string, number>();
  const positions = new Map<string, Pos>();
  const edges: Array<{ from: string; to: string }> = [];

  function subtreeWidth(node: LineageNode): number {
    const cached = widths.get(node.id);
    if (cached != null) return cached;
    if (node.children.length === 0) {
      widths.set(node.id, NODE_W + GAP_X);
      return NODE_W + GAP_X;
    }
    const sum = node.children.reduce(
      (acc, c) => acc + subtreeWidth(c),
      0,
    );
    const w = Math.max(NODE_W + GAP_X, sum);
    widths.set(node.id, w);
    return w;
  }

  function place(node: LineageNode, x: number, y: number) {
    const w = subtreeWidth(node);
    positions.set(node.id, { x: x + w / 2 - NODE_W / 2, y });
    let cx = x;
    for (const c of node.children) {
      const cw = subtreeWidth(c);
      edges.push({ from: node.id, to: c.id });
      place(c, cx, y + GAP_Y);
      cx += cw;
    }
  }

  const total = subtreeWidth(root);
  place(root, 0, 0);

  let maxY = 0;
  positions.forEach((p) => {
    if (p.y > maxY) maxY = p.y;
  });

  return {
    width: total,
    height: maxY + NODE_H + 8,
    positions,
    edges,
  };
}

function flattenNodes(root: LineageNode): LineageNode[] {
  const out: LineageNode[] = [];
  function walk(n: LineageNode) {
    out.push(n);
    for (const c of n.children) walk(c);
  }
  walk(root);
  return out;
}

const STATUS_COLOR: Record<string, string> = {
  AVAILABLE: "fill-green-100 stroke-green-300",
  IN_USE: "fill-blue-100 stroke-blue-300",
  QUARANTINE: "fill-yellow-100 stroke-yellow-300",
  RELEASED: "fill-purple-100 stroke-purple-300",
  DEPLETED: "fill-muted stroke-foreground/20",
  DISCARDED: "fill-rose-100 stroke-rose-300",
  VOIDED: "fill-rose-50 stroke-rose-200",
};

export function LineageTree({
  root,
  currentId,
}: {
  root: LineageNode | null;
  currentId: string;
}) {
  if (!root) {
    return (
      <p className="rounded border border-dashed p-6 text-center text-sm text-muted-foreground">
        无谱系数据
      </p>
    );
  }

  const layout = React.useMemo(() => buildLayout(root), [root]);
  const nodes = React.useMemo(() => flattenNodes(root), [root]);

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        共 {nodes.length} 个相关样本 · 当前样本高亮 ·
        点击节点跳转
      </div>
      <div className="overflow-auto rounded border bg-muted/20 p-3">
        <svg
          width={layout.width}
          height={layout.height}
          className="block"
          style={{ minWidth: layout.width }}
        >
          {/* edges */}
          {layout.edges.map((e, i) => {
            const a = layout.positions.get(e.from)!;
            const b = layout.positions.get(e.to)!;
            const x1 = a.x + NODE_W / 2;
            const y1 = a.y + NODE_H;
            const x2 = b.x + NODE_W / 2;
            const y2 = b.y;
            const midY = (y1 + y2) / 2;
            return (
              <path
                key={i}
                d={`M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`}
                fill="none"
                stroke="currentColor"
                strokeOpacity={0.3}
                strokeWidth={1}
              />
            );
          })}
          {/* nodes */}
          {nodes.map((n) => {
            const p = layout.positions.get(n.id)!;
            const isCurrent = n.id === currentId;
            return (
              <g key={n.id} transform={`translate(${p.x}, ${p.y})`}>
                <Link href={`/samples/${n.id}`}>
                  <rect
                    width={NODE_W}
                    height={NODE_H}
                    rx={6}
                    className={cn(
                      "cursor-pointer transition",
                      STATUS_COLOR[n.status] ?? "fill-background stroke-foreground/20",
                      isCurrent && "stroke-2 stroke-primary",
                    )}
                    strokeWidth={isCurrent ? 2 : 1}
                  />
                  <text
                    x={8}
                    y={20}
                    fontSize={11}
                    className="fill-foreground"
                  >
                    {n.typeIcon ? `${n.typeIcon} ` : ""}
                    {n.typeName}
                  </text>
                  <text
                    x={8}
                    y={36}
                    fontSize={11}
                    fontFamily="monospace"
                    className="fill-foreground font-medium"
                  >
                    {truncate(n.sampleCode, 16)}
                  </text>
                  <text
                    x={8}
                    y={50}
                    fontSize={10}
                    className="fill-muted-foreground"
                  >
                    {statusLabel(n.status)}
                  </text>
                </Link>
              </g>
            );
          })}
        </svg>
      </div>
      {/* legend / current sample status echo */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>状态：</span>
        {nodes
          .filter((n) => n.id === currentId)
          .map((n) => (
            <span key={n.id} className="inline-flex items-center gap-1">
              当前 → <SampleStatusBadge status={n.status} />
            </span>
          ))}
      </div>
    </div>
  );
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

function statusLabel(s: string): string {
  const m: Record<string, string> = {
    AVAILABLE: "可用",
    IN_USE: "使用中",
    QUARANTINE: "隔离",
    RELEASED: "已放行",
    DEPLETED: "已用完",
    DISCARDED: "已销毁",
    VOIDED: "已作废",
  };
  return m[s] ?? s;
}
