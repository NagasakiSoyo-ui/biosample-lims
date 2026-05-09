"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  LocationPicker,
  type PickerLocation,
} from "@/components/shared/location-picker";
import { batchCreateSamplesAction } from "@/server/actions/samples";
import { VOLUME_UNITS } from "@/server/services/samples";

const NONE = "__none__";

type ParentSample = {
  id: string;
  sampleCode: string;
  typeId: string;
  typeName: string;
  projectId: string;
  projectCode: string;
  status: string;
  locationPath: string;
  volume: number | null;
  volumeUnit: string | null;
  collectedAt: Date | null;
  frozenAt: Date | null;
  customFields: unknown;
};

export function BatchWizard({
  parents,
  projects,
  sampleTypes,
  locations,
  occupancy,
}: {
  parents: ParentSample[];
  projects: Array<{ id: string; code: string; name: string }>;
  sampleTypes: Array<{ id: string; code: string; name: string }>;
  locations: PickerLocation[];
  occupancy: Record<string, number>;
}) {
  const router = useRouter();
  const [step, setStep] = React.useState(1);
  const [parentId, setParentId] = React.useState<string | null>(null);
  const [count, setCount] = React.useState(2);
  const [strategy, setStrategy] = React.useState<"LETTER" | "NUMBER">(
    "LETTER",
  );
  const [numberStart, setNumberStart] = React.useState(1);
  const [slotIds, setSlotIds] = React.useState<string[]>([]);
  const [pending, setPending] = React.useState(false);

  const parent = parents.find((p) => p.id === parentId) ?? null;

  // Shared fields default from parent
  const [shared, setShared] = React.useState({
    projectId: "",
    typeId: "",
    purpose: "RESEARCH" as "RESEARCH" | "CLINICAL_INFUSION",
    volume: "",
    volumeUnit: "",
    collectedAt: "",
    frozenAt: "",
    notes: "",
  });

  React.useEffect(() => {
    if (parent) {
      setShared((s) => ({
        ...s,
        projectId: parent.projectId,
        typeId: parent.typeId,
        volume: parent.volume != null ? String(parent.volume) : "",
        volumeUnit: parent.volumeUnit ?? "",
        collectedAt: parent.collectedAt
          ? toIsoDate(parent.collectedAt)
          : "",
        frozenAt: parent.frozenAt ? toIsoDate(parent.frozenAt) : "",
      }));
    }
  }, [parent]);

  const previewCodes = React.useMemo(() => {
    if (!parent) return [];
    const suffixes =
      strategy === "LETTER"
        ? Array.from({ length: count }, (_, i) =>
            i < 26 ? String.fromCharCode(65 + i) : `?${i}`,
          )
        : Array.from({ length: count }, (_, i) =>
            String(numberStart + i).padStart(2, "0"),
          );
    return suffixes.map((s) => `${parent.sampleCode}-${s}`);
  }, [parent, count, strategy, numberStart]);

  function nextStep() {
    if (step === 1 && !parent) return toast.error("请先选择母样本");
    if (step === 2) {
      if (count < 1 || count > 100)
        return toast.error("数量必须在 1 到 100 之间");
      if (strategy === "LETTER" && count > 26)
        return toast.error("字母后缀策略最多支持 26 个");
    }
    if (step === 3) {
      if (slotIds.length !== count)
        return toast.error(
          `需要选 ${count} 个位置，当前已选 ${slotIds.length} 个`,
        );
    }
    setStep((s) => s + 1);
  }
  function prevStep() {
    setStep((s) => Math.max(1, s - 1));
  }

  async function submit() {
    if (!parent) return;
    setPending(true);
    const volNum = shared.volume.trim() === "" ? null : Number(shared.volume);
    if (
      shared.volume.trim() !== "" &&
      (!Number.isFinite(volNum) || volNum! < 0)
    ) {
      toast.error("体积必须为非负数");
      setPending(false);
      return;
    }
    const result = await batchCreateSamplesAction({
      parentSampleId: parent.id,
      count,
      suffixStrategy: strategy,
      numberStart: strategy === "NUMBER" ? numberStart : undefined,
      slotIds,
      shared: {
        projectId: shared.projectId,
        typeId: shared.typeId,
        purpose: shared.purpose,
        volume: volNum,
        volumeUnit: shared.volumeUnit === NONE ? "" : shared.volumeUnit,
        collectedAt: shared.collectedAt,
        frozenAt: shared.frozenAt,
        notes: shared.notes,
        customFields: (parent.customFields ?? {}) as Record<string, unknown>,
      },
    });
    setPending(false);
    if (result.success && result.data) {
      toast.success(`已成功创建 ${result.data.count} 个子样本`);
      router.push(`/samples?parentSampleId=${parent.id}`);
      router.refresh();
    } else if (!result.success) {
      toast.error(result.error);
    }
  }

  return (
    <div className="space-y-4">
      <Stepper step={step} />

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">第 1 步：选择母样本</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>母样本</Label>
              <Select
                value={parentId ?? NONE}
                onValueChange={(v) => setParentId(v === NONE ? null : v ?? null)}
                items={{
                  [NONE]: "—",
                  ...Object.fromEntries(
                    parents.map((p) => [
                      p.id,
                      `${p.sampleCode} (${p.typeName})`,
                    ]),
                  ),
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="搜索并选择母样本" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {parents.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.sampleCode} ({p.typeName})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {parent && (
              <div className="grid grid-cols-1 gap-2 rounded-md border bg-muted/30 p-3 text-sm sm:grid-cols-2">
                <div>
                  <span className="text-muted-foreground">编号：</span>
                  <span className="font-mono font-medium">
                    {parent.sampleCode}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">类型：</span>
                  {parent.typeName}
                </div>
                <div>
                  <span className="text-muted-foreground">项目：</span>
                  <Badge variant="outline">{parent.projectCode}</Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">状态：</span>
                  {parent.status}
                </div>
                <div className="sm:col-span-2">
                  <span className="text-muted-foreground">位置：</span>
                  <span className="text-xs">{parent.locationPath || "—"}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">第 2 步：分装数量与编号</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>子样本数量 *</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={count}
                  onChange={(e) =>
                    setCount(Math.max(1, Math.min(100, Number(e.target.value) || 1)))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>后缀策略</Label>
                <Select
                  value={strategy}
                  onValueChange={(v) =>
                    setStrategy((v ?? "LETTER") as typeof strategy)
                  }
                  items={{ LETTER: "字母 A-Z", NUMBER: "数字 01-" }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LETTER">字母 A-Z</SelectItem>
                    <SelectItem value="NUMBER">数字 01-</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {strategy === "NUMBER" && (
                <div className="space-y-1.5">
                  <Label>起始序号</Label>
                  <Input
                    type="number"
                    min={1}
                    value={numberStart}
                    onChange={(e) =>
                      setNumberStart(Math.max(1, Number(e.target.value) || 1))
                    }
                  />
                </div>
              )}
            </div>
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="mb-1 text-xs text-muted-foreground">
                生成预览（共 {previewCodes.length} 个）
              </div>
              <div className="flex flex-wrap gap-1">
                {(previewCodes.length <= 6
                  ? previewCodes
                  : [
                      ...previewCodes.slice(0, 5),
                      "...",
                      previewCodes[previewCodes.length - 1],
                    ]
                ).map((c, i) => (
                  <code
                    key={i}
                    className="rounded bg-background px-1.5 py-0.5 text-xs"
                  >
                    {c}
                  </code>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              第 3 步：选择 {count} 个位置
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LocationPicker
              mode="multi"
              values={slotIds}
              onChange={setSlotIds}
              maxCount={count}
              locations={locations}
              occupancy={occupancy}
            />
          </CardContent>
        </Card>
      )}

      {step === 4 && parent && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">第 4 步：共享字段</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>项目</Label>
              <Select
                value={shared.projectId}
                onValueChange={(v) =>
                  setShared((s) => ({ ...s, projectId: v ?? "" }))
                }
                items={Object.fromEntries(
                  projects.map((p) => [p.id, `${p.code} · ${p.name}`]),
                )}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.code} · {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>样本类型</Label>
              <Select
                value={shared.typeId}
                onValueChange={(v) =>
                  setShared((s) => ({ ...s, typeId: v ?? "" }))
                }
                items={Object.fromEntries(
                  sampleTypes.map((t) => [t.id, `${t.name} (${t.code})`]),
                )}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sampleTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({t.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>用途</Label>
              <Select
                value={shared.purpose}
                onValueChange={(v) =>
                  setShared((s) => ({
                    ...s,
                    purpose: (v ?? "RESEARCH") as typeof s.purpose,
                  }))
                }
                items={{ RESEARCH: "研究", CLINICAL_INFUSION: "临床回输" }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RESEARCH">研究</SelectItem>
                  <SelectItem value="CLINICAL_INFUSION">临床回输</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>每管体积</Label>
              <Input
                type="number"
                step="0.01"
                value={shared.volume}
                onChange={(e) =>
                  setShared((s) => ({ ...s, volume: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>单位</Label>
              <Select
                value={shared.volumeUnit || NONE}
                onValueChange={(v) =>
                  setShared((s) => ({ ...s, volumeUnit: v ?? "" }))
                }
                items={{
                  [NONE]: "—",
                  ...Object.fromEntries(VOLUME_UNITS.map((u) => [u, u])),
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择单位" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {VOLUME_UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>采集日期</Label>
              <Input
                type="date"
                value={shared.collectedAt}
                onChange={(e) =>
                  setShared((s) => ({ ...s, collectedAt: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>冻存日期</Label>
              <Input
                type="date"
                value={shared.frozenAt}
                onChange={(e) =>
                  setShared((s) => ({ ...s, frozenAt: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>共享备注</Label>
              <Textarea
                rows={2}
                value={shared.notes}
                onChange={(e) =>
                  setShared((s) => ({ ...s, notes: e.target.value }))
                }
              />
            </div>
            <p className="text-xs text-muted-foreground sm:col-span-2">
              动态字段默认继承母样本，可在创建后逐个编辑。
            </p>
          </CardContent>
        </Card>
      )}

      {step === 5 && parent && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              第 5 步：预览并确认创建 {count} 个子样本
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="overflow-x-auto rounded border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="p-2 text-left">序号</th>
                    <th className="p-2 text-left">样本编号</th>
                    <th className="p-2 text-left">位置</th>
                  </tr>
                </thead>
                <tbody>
                  {previewCodes.map((code, i) => {
                    const sid = slotIds[i];
                    const slot = locations.find((l) => l.id === sid);
                    return (
                      <tr key={code} className="border-t">
                        <td className="p-2">{i + 1}</td>
                        <td className="p-2 font-mono">{code}</td>
                        <td className="p-2 text-xs text-muted-foreground">
                          {slot?.name ?? "（已选）"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div>
                <span className="text-muted-foreground">母样本：</span>
                <span className="font-mono font-medium">
                  {parent.sampleCode}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">每管体积：</span>
                {shared.volume ? `${shared.volume} ${shared.volumeUnit}` : "—"}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={prevStep}
          disabled={step === 1 || pending}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          上一步
        </Button>
        {step < 5 ? (
          <Button onClick={nextStep}>
            下一步
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={submit} disabled={pending}>
            <CheckCircle2 className="mr-1 h-4 w-4" />
            {pending ? "创建中..." : `确认创建 ${count} 个样本`}
          </Button>
        )}
      </div>
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  const labels = ["选母样本", "分装数量", "选位置", "共享字段", "预览确认"];
  return (
    <ol className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
      {labels.map((l, i) => {
        const idx = i + 1;
        const active = idx === step;
        const done = idx < step;
        return (
          <li
            key={l}
            className={cn(
              "flex items-center gap-1 whitespace-nowrap rounded-full border px-3 py-1",
              active && "border-primary bg-primary text-primary-foreground",
              done && "border-green-300 bg-green-100 text-green-700",
              !active && !done && "border-muted-foreground/20 text-muted-foreground",
            )}
          >
            <span>{idx}.</span>
            <span>{l}</span>
          </li>
        );
      })}
    </ol>
  );
}

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
