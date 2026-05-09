"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createDonorAction,
  updateDonorAction,
  type DonorInput,
} from "@/server/actions/donors";

const formSchema = z.object({
  code: z.string().min(1, "脱敏 ID 不能为空"),
  gender: z.enum(["M", "F", "Unknown", ""]).optional(),
  ageAtCollection: z.string().optional(), // input as string, convert to number
  diagnosis: z.string().optional(),
  collectionDate: z.string().optional(), // YYYY-MM-DD
  sourceOrgId: z.string().optional(),
  projectId: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export type DonorForEdit = {
  id: string;
  code: string;
  gender: string | null;
  ageAtCollection: number | null;
  diagnosis: string | null;
  collectionDate: Date | null;
  projectId: string | null;
  sourceOrgId: string | null;
  notes: string | null;
};

const NONE = "__none__";

function dateToInput(d: Date | null): string {
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function DonorFormDialog({
  open,
  onOpenChange,
  editing,
  projects,
  sourceOrgs,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: DonorForEdit | null;
  projects: Array<{ id: string; name: string }>;
  sourceOrgs: Array<{ id: string; name: string }>;
}) {
  const isEdit = !!editing;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: "",
      gender: "",
      ageAtCollection: "",
      diagnosis: "",
      collectionDate: "",
      sourceOrgId: NONE,
      projectId: NONE,
      notes: "",
    },
  });

  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      form.reset({
        code: editing.code,
        gender: (editing.gender as FormValues["gender"]) ?? "",
        ageAtCollection:
          editing.ageAtCollection != null
            ? String(editing.ageAtCollection)
            : "",
        diagnosis: editing.diagnosis ?? "",
        collectionDate: dateToInput(editing.collectionDate),
        sourceOrgId: editing.sourceOrgId ?? NONE,
        projectId: editing.projectId ?? NONE,
        notes: editing.notes ?? "",
      });
    } else {
      form.reset({
        code: "",
        gender: "",
        ageAtCollection: "",
        diagnosis: "",
        collectionDate: "",
        sourceOrgId: NONE,
        projectId: NONE,
        notes: "",
      });
    }
  }, [open, editing, form]);

  async function onSubmit(values: FormValues) {
    const ageStr = (values.ageAtCollection ?? "").trim();
    let age: number | null | undefined = undefined;
    if (ageStr === "") {
      age = null;
    } else {
      const n = Number(ageStr);
      if (!Number.isInteger(n) || n < 0 || n > 200) {
        toast.error("采集年龄必须是 0 到 200 之间的整数");
        return;
      }
      age = n;
    }

    const input: DonorInput = {
      code: values.code,
      gender: values.gender || "",
      ageAtCollection: age,
      diagnosis: values.diagnosis ?? "",
      collectionDate: values.collectionDate ?? "",
      sourceOrgId: values.sourceOrgId === NONE ? "" : values.sourceOrgId ?? "",
      projectId: values.projectId === NONE ? "" : values.projectId ?? "",
      notes: values.notes ?? "",
    };

    const result = isEdit
      ? await updateDonorAction(editing!.id, input)
      : await createDonorAction(input);
    if (result.success) {
      toast.success(isEdit ? "已保存" : "已创建");
      onOpenChange(false);
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-xl overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "编辑供者" : "新增供者"}</DialogTitle>
          <DialogDescription>
            供者档案脱敏存储；脱敏 ID 全局唯一。
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id="donor-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>脱敏 ID *</FormLabel>
                    <FormControl>
                      <Input placeholder="如：GBM-P001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>性别</FormLabel>
                    <Select
                      value={field.value || ""}
                      onValueChange={(v) =>
                        field.onChange(v === NONE ? "" : v)
                      }
                      items={{
                        [NONE]: "—",
                        M: "男",
                        F: "女",
                        Unknown: "未知",
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="选择性别" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>—</SelectItem>
                        <SelectItem value="M">男</SelectItem>
                        <SelectItem value="F">女</SelectItem>
                        <SelectItem value="Unknown">未知</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ageAtCollection"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>采集年龄</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={200}
                        placeholder="整数"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="collectionDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>采集日期</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="diagnosis"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>诊断</FormLabel>
                  <FormControl>
                    <Input placeholder="如：胶质母细胞瘤" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>所属项目</FormLabel>
                    <Select
                      value={field.value || NONE}
                      onValueChange={field.onChange}
                      items={{
                        [NONE]: "—",
                        ...Object.fromEntries(
                          projects.map((p) => [p.id, p.name]),
                        ),
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="选择项目" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>—</SelectItem>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sourceOrgId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>来源单位</FormLabel>
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
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="选择来源单位" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>—</SelectItem>
                        {sourceOrgs.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>备注</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button
            type="submit"
            form="donor-form"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
