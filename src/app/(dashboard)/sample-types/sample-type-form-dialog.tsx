"use client";

import * as React from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  createSampleTypeAction,
  updateSampleTypeAction,
  type SampleTypeInput,
} from "@/server/actions/sample-types";

const fieldRowSchema = z.object({
  key: z
    .string()
    .min(1, "字段标识不能为空")
    .regex(
      /^[a-z][a-z0-9_]*$/,
      "字段标识只能为小写字母、数字、下划线，且以字母开头",
    ),
  label: z.string().min(1, "字段名称不能为空"),
  type: z.enum(["text", "number", "date", "select", "boolean"]),
  required: z.boolean(),
  optionsRaw: z.string().optional(),
});

const formSchema = z
  .object({
    name: z.string().min(1, "名称不能为空"),
    code: z
      .string()
      .min(1, "缩写不能为空")
      .regex(
        /^[A-Z][A-Z0-9_-]*$/,
        "缩写只能为大写字母、数字、下划线、连字符，以字母开头",
      ),
    icon: z.string().optional(),
    description: z.string().optional(),
    fields: z.array(fieldRowSchema),
  })
  .superRefine((val, ctx) => {
    val.fields.forEach((f, i) => {
      if (f.type === "select") {
        const options = (f.optionsRaw ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (options.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "下拉选项不能为空（用英文逗号分隔）",
            path: ["fields", i, "optionsRaw"],
          });
        }
      }
    });
    const seen = new Set<string>();
    val.fields.forEach((f, i) => {
      if (seen.has(f.key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "字段标识重复",
          path: ["fields", i, "key"],
        });
      }
      seen.add(f.key);
    });
  });

type FormValues = z.infer<typeof formSchema>;

export type SampleTypeForEdit = {
  id: string;
  name: string;
  code: string;
  icon: string | null;
  description: string | null;
  customFieldsSchema: unknown;
};

type StoredField = {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "boolean";
  required: boolean;
  options?: string[];
};

export function SampleTypeFormDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: SampleTypeForEdit | null;
}) {
  const isEdit = !!editing;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      code: "",
      icon: "",
      description: "",
      fields: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "fields",
  });

  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      const stored = Array.isArray(editing.customFieldsSchema)
        ? (editing.customFieldsSchema as StoredField[])
        : [];
      form.reset({
        name: editing.name,
        code: editing.code,
        icon: editing.icon ?? "",
        description: editing.description ?? "",
        fields: stored.map((f) => ({
          key: f.key,
          label: f.label,
          type: f.type,
          required: !!f.required,
          optionsRaw: f.options?.join(", ") ?? "",
        })),
      });
    } else {
      form.reset({
        name: "",
        code: "",
        icon: "",
        description: "",
        fields: [],
      });
    }
  }, [open, editing, form]);

  async function onSubmit(values: FormValues) {
    const input: SampleTypeInput = {
      name: values.name,
      code: values.code,
      icon: values.icon || undefined,
      description: values.description || undefined,
      fields: values.fields.map((f) => {
        const base = {
          key: f.key,
          label: f.label,
          type: f.type,
          required: f.required,
        };
        if (f.type === "select") {
          const options = (f.optionsRaw ?? "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          return { ...base, options };
        }
        return base;
      }),
    };

    const result = isEdit
      ? await updateSampleTypeAction(editing!.id, input)
      : await createSampleTypeAction(input);

    if (result.success) {
      toast.success(isEdit ? "已保存" : "已创建");
      onOpenChange(false);
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-2xl overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "编辑样本类型" : "新增样本类型"}
          </DialogTitle>
          <DialogDescription>
            专属字段会在样本登记时按此配置动态生成表单。
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-5"
            id="sample-type-form"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>名称 *</FormLabel>
                    <FormControl>
                      <Input placeholder="如：细胞" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>缩写 *</FormLabel>
                    <FormControl>
                      <Input placeholder="如：CELL" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="icon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>图标</FormLabel>
                    <FormControl>
                      <Input placeholder="emoji，如 🧫" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>描述</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder="选填：对该类型的简要说明"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium">专属字段配置</h3>
                  <p className="text-xs text-muted-foreground">
                    样本登记时按此配置动态生成额外字段
                  </p>
                </div>
              </div>

              {fields.length === 0 && (
                <p className="rounded border border-dashed p-4 text-center text-sm text-muted-foreground">
                  暂无专属字段，点击下方「添加字段」开始配置
                </p>
              )}

              <div className="space-y-3">
                {fields.map((row, i) => {
                  const type = form.watch(`fields.${i}.type`);
                  return (
                    <div
                      key={row.id}
                      className="space-y-2 rounded-md border bg-muted/30 p-3"
                    >
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
                        <FormField
                          control={form.control}
                          name={`fields.${i}.key`}
                          render={({ field }) => (
                            <FormItem className="sm:col-span-3">
                              <FormLabel className="text-xs">
                                字段标识 *
                              </FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="passage"
                                  {...field}
                                  className="h-8"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`fields.${i}.label`}
                          render={({ field }) => (
                            <FormItem className="sm:col-span-3">
                              <FormLabel className="text-xs">
                                字段名称 *
                              </FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="代次"
                                  {...field}
                                  className="h-8"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`fields.${i}.type`}
                          render={({ field }) => (
                            <FormItem className="sm:col-span-2">
                              <FormLabel className="text-xs">类型</FormLabel>
                              <Select
                                value={field.value}
                                onValueChange={field.onChange}
                                items={{
                                  text: "文本",
                                  number: "数字",
                                  date: "日期",
                                  select: "下拉",
                                  boolean: "是否",
                                }}
                              >
                                <FormControl>
                                  <SelectTrigger className="h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="text">文本</SelectItem>
                                  <SelectItem value="number">数字</SelectItem>
                                  <SelectItem value="date">日期</SelectItem>
                                  <SelectItem value="select">下拉</SelectItem>
                                  <SelectItem value="boolean">是否</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`fields.${i}.required`}
                          render={({ field }) => (
                            <FormItem className="flex flex-col sm:col-span-2">
                              <FormLabel className="text-xs">必填</FormLabel>
                              <FormControl>
                                <div className="flex h-8 items-center">
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={(v) =>
                                      field.onChange(v === true)
                                    }
                                  />
                                </div>
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <div className="flex items-end justify-end sm:col-span-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => remove(i)}
                            aria-label="删除该字段"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {type === "select" && (
                        <FormField
                          control={form.control}
                          name={`fields.${i}.optionsRaw`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">
                                下拉选项 *（用英文逗号分隔）
                              </FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="EDTA, Heparin, Citrate"
                                  {...field}
                                  className="h-8"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  append({
                    key: "",
                    label: "",
                    type: "text",
                    required: false,
                    optionsRaw: "",
                  })
                }
              >
                <Plus className="mr-1 h-4 w-4" />
                添加字段
              </Button>
            </div>
          </form>
        </Form>

        <DialogFooter>
          <Button
            variant="outline"
            type="button"
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button
            type="submit"
            form="sample-type-form"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
