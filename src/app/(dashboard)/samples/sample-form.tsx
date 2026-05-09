"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LocationPicker,
  type PickerLocation,
} from "@/components/shared/location-picker";
import {
  parseCustomFieldsSchema,
  VOLUME_UNITS,
  type CustomFieldSpec,
} from "@/server/services/samples";
import {
  createSampleAction,
  updateSampleAction,
  generateSampleCodeAction,
  type CreateSampleInput,
  type UpdateSampleInput,
} from "@/server/actions/samples";
import { DynamicFields } from "./sample-form-dynamic-fields";

const NONE = "__none__";

export type SampleFormValues = {
  projectId: string;
  typeId: string;
  purpose: "RESEARCH" | "CLINICAL_INFUSION";
  sourceOrgId: string;
  donorId: string;
  sampleCode: string;
  parentSampleId: string;
  volume: string;
  volumeUnit: string;
  collectedAt: string;
  frozenAt: string;
  expireAt: string;
  locationId: string;
  noLocation: boolean;
  notes: string;
  customFields: Record<string, unknown>;
};

export type SampleFormProps = {
  mode: "create" | "edit";
  initial?: Partial<SampleFormValues>;
  editingId?: string;
  projects: Array<{ id: string; code: string; name: string }>;
  sampleTypes: Array<{
    id: string;
    code: string;
    name: string;
    icon: string | null;
    customFieldsSchema: unknown;
  }>;
  sourceOrgs: Array<{ id: string; name: string }>;
  donors: Array<{ id: string; code: string; diagnosis: string | null }>;
  parentSamples: Array<{ id: string; sampleCode: string; typeName: string }>;
  locations: PickerLocation[];
  occupancy: Record<string, number>;
};

const EMPTY_VALUES: SampleFormValues = {
  projectId: "",
  typeId: "",
  purpose: "RESEARCH",
  sourceOrgId: "",
  donorId: "",
  sampleCode: "",
  parentSampleId: "",
  volume: "",
  volumeUnit: "",
  collectedAt: "",
  frozenAt: "",
  expireAt: "",
  locationId: "",
  noLocation: false,
  notes: "",
  customFields: {},
};

export function SampleForm({
  mode,
  initial,
  editingId,
  projects,
  sampleTypes,
  sourceOrgs,
  donors,
  parentSamples,
  locations,
  occupancy,
}: SampleFormProps) {
  const router = useRouter();
  const isEdit = mode === "edit";

  const form = useForm<SampleFormValues>({
    defaultValues: { ...EMPTY_VALUES, ...(initial ?? {}) },
  });

  const typeId = form.watch("typeId");
  const projectId = form.watch("projectId");
  const noLocation = form.watch("noLocation");
  const locationId = form.watch("locationId");

  const selectedType = sampleTypes.find((t) => t.id === typeId);
  const customFieldsSchema: CustomFieldSpec[] = React.useMemo(
    () =>
      selectedType
        ? parseCustomFieldsSchema(selectedType.customFieldsSchema)
        : [],
    [selectedType],
  );

  // Reset customFields when type changes (but only when user actively changes
  // it — not when the initial values pre-fill).
  const initialTypeRef = React.useRef(initial?.typeId);
  React.useEffect(() => {
    if (typeId && typeId !== initialTypeRef.current) {
      form.setValue("customFields", {});
      initialTypeRef.current = typeId;
    }
  }, [typeId, form]);

  async function handleAutoGenerate() {
    if (!projectId || !typeId) {
      toast.error("请先选择项目和样本类型");
      return;
    }
    const result = await generateSampleCodeAction(projectId, typeId);
    if (result.success && result.data) {
      form.setValue("sampleCode", result.data.sampleCode, {
        shouldValidate: true,
      });
    } else if (!result.success) {
      toast.error(result.error);
    }
  }

  async function onSubmit(values: SampleFormValues) {
    if (!values.projectId) return toast.error("请选择项目");
    if (!values.typeId) return toast.error("请选择样本类型");
    if (!isEdit && !values.sampleCode.trim())
      return toast.error("请填写样本编号");

    const volumeNum =
      values.volume.trim() === "" ? null : Number(values.volume);
    if (
      values.volume.trim() !== "" &&
      (!Number.isFinite(volumeNum) || volumeNum! < 0)
    ) {
      return toast.error("体积必须为非负数");
    }

    const locId = values.noLocation ? "" : values.locationId;

    if (isEdit && editingId) {
      const input: UpdateSampleInput = {
        projectId: values.projectId,
        typeId: values.typeId,
        purpose: values.purpose,
        sourceOrgId: values.sourceOrgId === NONE ? "" : values.sourceOrgId,
        donorId: values.donorId === NONE ? "" : values.donorId,
        parentSampleId:
          values.parentSampleId === NONE ? "" : values.parentSampleId,
        locationId: locId,
        volume: volumeNum,
        volumeUnit: values.volumeUnit === NONE ? "" : values.volumeUnit,
        collectedAt: values.collectedAt,
        frozenAt: values.frozenAt,
        expireAt: values.expireAt,
        customFields: values.customFields,
        notes: values.notes,
      };
      const result = await updateSampleAction(editingId, input);
      if (result.success) {
        toast.success("已保存");
        router.push(`/samples/${editingId}`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
      return;
    }

    const input: CreateSampleInput = {
      projectId: values.projectId,
      typeId: values.typeId,
      purpose: values.purpose,
      sourceOrgId: values.sourceOrgId === NONE ? "" : values.sourceOrgId,
      donorId: values.donorId === NONE ? "" : values.donorId,
      parentSampleId:
        values.parentSampleId === NONE ? "" : values.parentSampleId,
      sampleCode: values.sampleCode.trim(),
      locationId: locId,
      volume: volumeNum,
      volumeUnit: values.volumeUnit === NONE ? "" : values.volumeUnit,
      collectedAt: values.collectedAt,
      frozenAt: values.frozenAt,
      expireAt: values.expireAt,
      customFields: values.customFields,
      notes: values.notes,
    };
    const result = await createSampleAction(input);
    if (result.success && result.data) {
      toast.success("样本登记成功");
      router.push(`/samples/${result.data.id}`);
      router.refresh();
    } else if (!result.success) {
      toast.error(result.error);
    }
  }

  const selectedParent = parentSamples.find(
    (p) => p.id === form.watch("parentSampleId"),
  );

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-6"
      id="sample-form"
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">基本信息</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Controller
            control={form.control}
            name="projectId"
            render={({ field }) => (
              <div className="space-y-1.5">
                <Label>项目 *</Label>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  items={Object.fromEntries(
                    projects.map((p) => [p.id, `${p.code} · ${p.name}`]),
                  )}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择项目" />
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
            )}
          />
          <Controller
            control={form.control}
            name="typeId"
            render={({ field }) => (
              <div className="space-y-1.5">
                <Label>样本类型 *</Label>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  items={Object.fromEntries(
                    sampleTypes.map((t) => [
                      t.id,
                      `${t.icon ? `${t.icon} ` : ""}${t.name} (${t.code})`,
                    ]),
                  )}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择样本类型" />
                  </SelectTrigger>
                  <SelectContent>
                    {sampleTypes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.icon ? `${t.icon} ` : ""}
                        {t.name} ({t.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          />
          <Controller
            control={form.control}
            name="purpose"
            render={({ field }) => (
              <div className="space-y-1.5">
                <Label>用途 *</Label>
                <div className="flex items-center gap-4 pt-1">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={field.value === "RESEARCH"}
                      onChange={() => field.onChange("RESEARCH")}
                    />
                    研究
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={field.value === "CLINICAL_INFUSION"}
                      onChange={() => field.onChange("CLINICAL_INFUSION")}
                    />
                    临床回输
                  </label>
                </div>
              </div>
            )}
          />
          <Controller
            control={form.control}
            name="sourceOrgId"
            render={({ field }) => (
              <div className="space-y-1.5">
                <Label>来源单位</Label>
                <Select
                  value={field.value || NONE}
                  onValueChange={field.onChange}
                  items={{
                    [NONE]: "—",
                    ...Object.fromEntries(
                      sourceOrgs.map((s) => [s.id, s.name]),
                    ),
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择来源单位" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>—</SelectItem>
                    {sourceOrgs.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          />
          <Controller
            control={form.control}
            name="donorId"
            render={({ field }) => (
              <div className="space-y-1.5 sm:col-span-2">
                <Label>供者</Label>
                <Select
                  value={field.value || NONE}
                  onValueChange={field.onChange}
                  items={{
                    [NONE]: "—",
                    ...Object.fromEntries(
                      donors.map((d) => [
                        d.id,
                        `${d.code}${d.diagnosis ? ` - ${d.diagnosis}` : ""}`,
                      ]),
                    ),
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择供者" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>—</SelectItem>
                    {donors.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.code}
                        {d.diagnosis ? ` - ${d.diagnosis}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">样本编号</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Controller
            control={form.control}
            name="sampleCode"
            render={({ field }) => (
              <div className="space-y-1.5">
                <Label>样本编号 *</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="如：GBM-TIL-250509-01"
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    disabled={isEdit}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="default"
                    onClick={handleAutoGenerate}
                    disabled={isEdit}
                  >
                    <Sparkles className="mr-1 h-4 w-4" />
                    自动生成
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  规则：项目代码-类型代码-YYMMDD-当日序号。项目内唯一。
                </p>
              </div>
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">母样本（可选）</CardTitle>
        </CardHeader>
        <CardContent>
          <Controller
            control={form.control}
            name="parentSampleId"
            render={({ field }) => (
              <div className="space-y-1.5">
                <Label>母样本</Label>
                <Select
                  value={field.value || NONE}
                  onValueChange={field.onChange}
                  disabled={isEdit}
                  items={{
                    [NONE]: "—",
                    ...Object.fromEntries(
                      parentSamples.map((p) => [
                        p.id,
                        `${p.sampleCode} (${p.typeName})`,
                      ]),
                    ),
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="无" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>—</SelectItem>
                    {parentSamples.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.sampleCode} ({p.typeName})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedParent && (
                  <div className="mt-2 rounded border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    已选母样本：
                    <span className="ml-1 font-mono font-medium text-foreground">
                      {selectedParent.sampleCode}
                    </span>
                    <span className="ml-2">类型：{selectedParent.typeName}</span>
                  </div>
                )}
                {isEdit && (
                  <p className="text-xs text-muted-foreground">
                    母样本一旦创建不可修改。如需更正请新建并将原样本作废。
                  </p>
                )}
              </div>
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">量与时间</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Controller
            control={form.control}
            name="volume"
            render={({ field }) => (
              <div className="space-y-1.5">
                <Label>体积 / 数量</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                />
              </div>
            )}
          />
          <Controller
            control={form.control}
            name="volumeUnit"
            render={({ field }) => (
              <div className="space-y-1.5">
                <Label>单位</Label>
                <Select
                  value={field.value || NONE}
                  onValueChange={field.onChange}
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
            )}
          />
          <Controller
            control={form.control}
            name="collectedAt"
            render={({ field }) => (
              <div className="space-y-1.5">
                <Label>采集日期</Label>
                <Input
                  type="date"
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                />
              </div>
            )}
          />
          <Controller
            control={form.control}
            name="frozenAt"
            render={({ field }) => (
              <div className="space-y-1.5">
                <Label>冻存日期</Label>
                <Input
                  type="date"
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                />
              </div>
            )}
          />
          <Controller
            control={form.control}
            name="expireAt"
            render={({ field }) => (
              <div className="space-y-1.5 sm:col-span-2">
                <Label>有效期</Label>
                <Input
                  type="date"
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                />
              </div>
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">存储位置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Controller
            control={form.control}
            name="noLocation"
            render={({ field }) => (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(v) => field.onChange(v === true)}
                />
                <span>不放入存储（少数情况，如样本未冻存或已用完）</span>
              </label>
            )}
          />
          {!noLocation && (
            <Controller
              control={form.control}
              name="locationId"
              render={({ field }) => (
                <LocationPicker
                  mode="single"
                  value={field.value || null}
                  onChange={(v) => field.onChange(v ?? "")}
                  locations={locations}
                  occupancy={occupancy}
                  excludeSampleId={editingId}
                />
              )}
            />
          )}
          {!noLocation && !locationId && (
            <p className="text-xs text-muted-foreground">
              请在上方选择一个 SLOT，否则提交会失败。
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            专属字段
            {selectedType ? `（${selectedType.name}）` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedType ? (
            <DynamicFields
              schema={customFieldsSchema}
              control={form.control as unknown as Parameters<typeof DynamicFields>[0]["control"]}
            />
          ) : (
            <p className="rounded border border-dashed p-3 text-center text-xs text-muted-foreground">
              选择样本类型后此区将根据类型配置动态生成字段
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">备注</CardTitle>
        </CardHeader>
        <CardContent>
          <Controller
            control={form.control}
            name="notes"
            render={({ field }) => (
              <Textarea
                rows={3}
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
              />
            )}
          />
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          取消
        </Button>
        <Button
          type="submit"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting
            ? "提交中..."
            : isEdit
              ? "保存"
              : "登记样本"}
        </Button>
      </div>
    </form>
  );
}
