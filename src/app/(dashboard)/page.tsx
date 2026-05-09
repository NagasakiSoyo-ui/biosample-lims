import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { ArrowRight, AlertTriangle, Clock, FolderKanban } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  getDashboardStats,
  getProjectStats,
  getTypeDistribution,
  getRecentAudits,
} from "@/server/services/dashboard";
import {
  SAMPLE_STATUS_LABEL,
  SAMPLE_PURPOSE_LABEL,
} from "@/server/services/samples";
import {
  actionLabel,
  AUDIT_ENTITY_LABEL,
} from "@/lib/audit-action-labels";
import {
  TypeDistributionChart,
  StatusDistributionChart,
  ProjectMiniBar,
} from "./dashboard-charts";
import type { SampleStatus } from "@prisma/client";

export const metadata = { title: "仪表盘 · BioSample LIMS" };

const STATUS_PILL: Record<SampleStatus, string> = {
  AVAILABLE: "bg-green-100 text-green-700 border-green-200",
  IN_USE: "bg-blue-100 text-blue-700 border-blue-200",
  QUARANTINE: "bg-yellow-100 text-yellow-800 border-yellow-200",
  RELEASED: "bg-purple-100 text-purple-700 border-purple-200",
  DEPLETED: "bg-muted text-muted-foreground border-foreground/10",
  DISCARDED: "bg-rose-100 text-rose-700 border-rose-200",
  VOIDED: "bg-rose-50 text-rose-500 border-rose-200 line-through",
};

const STATUS_ORDER: SampleStatus[] = [
  "AVAILABLE",
  "IN_USE",
  "QUARANTINE",
  "RELEASED",
  "DEPLETED",
  "DISCARDED",
  "VOIDED",
];

export default async function DashboardPage() {
  const [stats, projects, typeDist, audits] = await Promise.all([
    getDashboardStats(),
    getProjectStats(),
    getTypeDistribution(),
    getRecentAudits(20),
  ]);

  const expiringSeverity =
    stats.expiringCount === 0
      ? "ok"
      : stats.expiringCount <= 5
        ? "warn"
        : "bad";
  const ftSeverity = stats.highFreezeThawCount === 0 ? "ok" : "warn";

  function entityHref(entityType: string, entityId: string | null): string {
    if (!entityId) return "#";
    if (entityType === "Sample") return `/samples/${entityId}`;
    const pathMap: Record<string, string> = {
      SampleType: "/sample-types",
      Project: "/projects",
      SourceOrg: "/source-orgs",
      Donor: "/donors",
      Location: "/locations",
      User: "/users",
    };
    return pathMap[entityType] ?? "#";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">仪表盘</h1>
        <p className="text-sm text-muted-foreground">样本管理系统总览</p>
      </div>

      {/* === KPI Cards === */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* 样本总数 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              样本总数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tabular-nums">
              {stats.totalActiveSamples}
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {STATUS_ORDER.map((s) => {
                const n = stats.statusBreakdown[s];
                if (!n) return null;
                return (
                  <Badge
                    key={s}
                    variant="outline"
                    className={cn("text-[10px]", STATUS_PILL[s])}
                  >
                    {SAMPLE_STATUS_LABEL[s]} {n}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* 项目数 */}
        <Link href="/projects" className="group">
          <Card className="h-full transition group-hover:border-primary/40">
            <CardHeader className="pb-2 flex-row items-start justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                项目数
              </CardTitle>
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tabular-nums">
                {stats.projectTotal}
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                研究 {stats.purposeBreakdown.RESEARCH ?? 0} ·
                临床回输 {stats.purposeBreakdown.CLINICAL_INFUSION ?? 0}
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* 即将过期 */}
        <Link
          href={`/samples?expireBefore=${stats.expiringCutoff}`}
          className="group"
        >
          <Card
            className={cn(
              "h-full transition group-hover:border-primary/40",
              expiringSeverity === "warn" && "border-yellow-300/60",
              expiringSeverity === "bad" && "border-rose-300/60",
            )}
          >
            <CardHeader className="pb-2 flex-row items-start justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                即将过期（30 天内）
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div
                className={cn(
                  "text-3xl font-semibold tabular-nums",
                  expiringSeverity === "warn" && "text-yellow-700",
                  expiringSeverity === "bad" && "text-rose-600",
                )}
              >
                {stats.expiringCount}
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                {stats.expiringCount === 0
                  ? "无即将过期样本"
                  : "请及时处理"}
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* 高冻融次数 */}
        <Link href="/samples?freezeThawMin=4" className="group">
          <Card
            className={cn(
              "h-full transition group-hover:border-primary/40",
              ftSeverity === "warn" && "border-yellow-300/60",
            )}
          >
            <CardHeader className="pb-2 flex-row items-start justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                冻融次数 &gt; 3
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div
                className={cn(
                  "text-3xl font-semibold tabular-nums",
                  ftSeverity === "warn" && "text-yellow-700",
                )}
              >
                {stats.highFreezeThawCount}
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                频繁冻融可能损害细胞活性
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* === Main 7/12 + 5/12 === */}
      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">按项目分布</CardTitle>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <p className="rounded border border-dashed p-6 text-center text-sm text-muted-foreground">
                暂无启用的项目
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {projects.map((p) => (
                  <Link
                    key={p.id}
                    href={`/samples?projectId=${p.id}`}
                    className="block"
                  >
                    <div className="rounded-md border p-3 transition hover:border-primary/40 hover:bg-accent/30">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div
                            className="truncate text-sm font-medium"
                            title={p.name}
                          >
                            {p.name}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1">
                            <Badge variant="outline" className="text-[10px]">
                              {p.code}
                            </Badge>
                            <Badge
                              variant={
                                p.purpose === "CLINICAL_INFUSION"
                                  ? "default"
                                  : "secondary"
                              }
                              className="text-[10px]"
                            >
                              {SAMPLE_PURPOSE_LABEL[p.purpose]}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-2xl font-semibold tabular-nums">
                          {p.totalSamples}
                        </div>
                      </div>
                      <div className="mt-2">
                        <ProjectMiniBar
                          segments={p.typeBreakdown}
                          total={p.totalSamples}
                        />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span>可用 {p.availableSamples}</span>
                        <span>本月新增 {p.newThisMonth}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-5">
          <TypeDistributionChart typeData={typeDist.typeData} />
          <StatusDistributionChart statusData={typeDist.statusData} />
        </div>
      </div>

      {/* === Recent activity timeline === */}
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">最近操作</CardTitle>
          <Link
            href="/audit-logs"
            className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
          >
            查看全部 <ArrowRight className="ml-0.5 h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {audits.length === 0 ? (
            <p className="rounded border border-dashed p-6 text-center text-sm text-muted-foreground">
              暂无操作记录
            </p>
          ) : (
            <ol className="space-y-2 text-sm">
              {audits.map((a) => {
                const href = entityHref(a.entityType, a.entityId);
                return (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center gap-2 border-b py-1.5 last:border-b-0"
                  >
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(a.createdAt, {
                        addSuffix: true,
                        locale: zhCN,
                      })}
                    </span>
                    <span className="text-sm">
                      {a.user?.name ?? "（已删除用户）"}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {actionLabel(a.action)}
                    </Badge>
                    {href !== "#" ? (
                      <Link
                        href={href}
                        className="text-xs font-mono text-primary hover:underline"
                      >
                        {AUDIT_ENTITY_LABEL[a.entityType] ?? a.entityType}
                        {a.entityId ? ` · ${a.entityId.slice(-6)}` : ""}
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {AUDIT_ENTITY_LABEL[a.entityType] ?? a.entityType}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
