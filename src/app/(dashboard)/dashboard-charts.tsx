"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import type { SampleStatus } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SAMPLE_STATUS_LABEL } from "@/server/services/samples";

// 8-color palette good enough for ~6 sample types.
const TYPE_PALETTE = [
  "#0ea5e9", // sky
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ec4899", // pink
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#84cc16", // lime
  "#f97316", // orange
];

// Status colors mirror SampleStatusBadge so the dashboard matches the list.
const STATUS_COLOR: Record<SampleStatus, string> = {
  AVAILABLE: "#22c55e",
  IN_USE: "#3b82f6",
  QUARANTINE: "#eab308",
  RELEASED: "#a855f7",
  DEPLETED: "#9ca3af",
  DISCARDED: "#f43f5e",
  VOIDED: "#fda4af",
};

type Slice = { name: string; value: number; fill: string };

function DonutCard({
  title,
  slices,
  emptyMessage,
}: {
  title: string;
  slices: Slice[];
  emptyMessage: string;
}) {
  const total = slices.reduce((acc, s) => acc + s.value, 0);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="rounded border border-dashed p-6 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </p>
        ) : (
          // Pie pinned to cx="35%" so the right side reserves room for the
          // vertical Legend. The center-text overlay uses the same anchor so
          // "总计 N" sits inside the donut hole instead of clipping the pie.
          <div className="relative h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="name"
                  cx="35%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={1}
                  startAngle={90}
                  endAngle={-270}
                >
                  {slices.map((s, i) => (
                    <Cell key={i} fill={s.fill} stroke="white" />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => {
                    const v = Number(value ?? 0);
                    return [
                      `${v} (${((v / total) * 100).toFixed(0)}%)`,
                      String(name ?? ""),
                    ];
                  }}
                />
                <Legend
                  layout="vertical"
                  align="right"
                  verticalAlign="middle"
                  iconSize={10}
                  wrapperStyle={{ right: 0, width: "30%" }}
                  formatter={(v: string) => (
                    <span className="text-xs">{v}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
            <div
              className="pointer-events-none absolute inset-y-0 flex flex-col items-center justify-center"
              style={{ left: 0, width: "70%" }}
            >
              <div className="text-xs text-muted-foreground">总计</div>
              <div className="text-2xl font-semibold tabular-nums">
                {total}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function TypeDistributionChart({
  typeData,
}: {
  typeData: Array<{ typeId: string; name: string; icon: string | null; count: number }>;
}) {
  const slices: Slice[] = typeData.map((t, i) => ({
    name: `${t.icon ?? ""} ${t.name}`.trim(),
    value: t.count,
    fill: TYPE_PALETTE[i % TYPE_PALETTE.length],
  }));
  return (
    <DonutCard
      title="样本类型分布"
      slices={slices}
      emptyMessage="暂无样本"
    />
  );
}

export function StatusDistributionChart({
  statusData,
}: {
  statusData: Array<{ status: SampleStatus; count: number }>;
}) {
  const slices: Slice[] = statusData.map((s) => ({
    name: SAMPLE_STATUS_LABEL[s.status],
    value: s.count,
    fill: STATUS_COLOR[s.status],
  }));
  return (
    <DonutCard
      title="样本状态分布"
      slices={slices}
      emptyMessage="暂无样本"
    />
  );
}

// Mini stacked bar for project cards. Renders a single horizontal segmented
// bar; each segment width = type.count / total.
export function ProjectMiniBar({
  segments,
  total,
}: {
  segments: Array<{ typeId: string; name: string; count: number }>;
  total: number;
}) {
  if (total === 0) {
    return (
      <div className="h-2 rounded bg-muted" title="暂无样本" />
    );
  }
  return (
    <div className="flex h-2 overflow-hidden rounded">
      {segments.map((s, i) => (
        <div
          key={s.typeId}
          style={{
            width: `${((s.count / total) * 100).toFixed(2)}%`,
            background: TYPE_PALETTE[i % TYPE_PALETTE.length],
          }}
          title={`${s.name}: ${s.count}`}
        />
      ))}
    </div>
  );
}
