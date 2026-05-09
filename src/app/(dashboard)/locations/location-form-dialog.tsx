"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import type { LocationLevel } from "@prisma/client";
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
  childLevelOf,
  LEVEL_LABEL,
} from "@/server/services/locations";
import {
  createLocationAction,
  updateLocationAction,
  type LocationInput,
  type LocationUpdateInput,
} from "@/server/actions/locations";
import type { LocationNode } from "./locations-shell";

export type LocationFormMode =
  | {
      mode: "create";
      parentId: string | null;
      parentLevel: LocationLevel | null;
      // SLOT only: target position in the parent BOX (0-based).
      position?: number;
      // SLOT only: pre-filled name (defaults to the cell label like "A3").
      defaultName?: string;
    }
  | { mode: "edit"; node: LocationNode };

const formSchema = z.object({
  name: z.string().min(1, "名称不能为空"),
  code: z.string().optional(),
  notes: z.string().optional(),
  gridRows: z.string().optional(),
  gridCols: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

function parseDim(v: string | undefined): number | null {
  const trimmed = (v ?? "").trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 1 || n > 50) return null;
  return n;
}

export function LocationFormDialog({
  open,
  onOpenChange,
  mode,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: LocationFormMode | null;
}) {
  const targetLevel: LocationLevel | null = React.useMemo(() => {
    if (!mode) return null;
    if (mode.mode === "edit") return mode.node.level;
    return childLevelOf(mode.parentLevel);
  }, [mode]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      code: "",
      notes: "",
      gridRows: "10",
      gridCols: "10",
    },
  });

  React.useEffect(() => {
    if (!open || !mode) return;
    if (mode.mode === "edit") {
      form.reset({
        name: mode.node.name,
        code: mode.node.code ?? "",
        notes: mode.node.notes ?? "",
        gridRows:
          mode.node.gridRows != null ? String(mode.node.gridRows) : "10",
        gridCols:
          mode.node.gridCols != null ? String(mode.node.gridCols) : "10",
      });
    } else {
      form.reset({
        name: mode.defaultName ?? "",
        code: "",
        notes: "",
        gridRows: "10",
        gridCols: "10",
      });
    }
  }, [open, mode, form]);

  if (!mode || !targetLevel) {
    return null;
  }

  async function onSubmit(values: FormValues) {
    if (!mode || !targetLevel) return;

    if (targetLevel === "BOX") {
      const r = parseDim(values.gridRows);
      const c = parseDim(values.gridCols);
      if (r === null || c === null) {
        toast.error("行数和列数必须是 1 到 50 之间的整数");
        return;
      }
    }

    const gridRows =
      targetLevel === "BOX" ? parseDim(values.gridRows) : null;
    const gridCols =
      targetLevel === "BOX" ? parseDim(values.gridCols) : null;

    if (mode.mode === "create") {
      if (targetLevel === "SLOT" && typeof mode.position !== "number") {
        toast.error("孔位必须从冻存盒网格点击空格创建");
        return;
      }
      const input: LocationInput = {
        parentId: mode.parentId,
        name: values.name,
        code: values.code ?? "",
        notes: values.notes ?? "",
        gridRows,
        gridCols,
        position: targetLevel === "SLOT" ? (mode.position ?? null) : null,
      };
      const result = await createLocationAction(input);
      if (result.success) {
        toast.success("已创建");
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    } else {
      const input: LocationUpdateInput = {
        name: values.name,
        code: values.code ?? "",
        notes: values.notes ?? "",
        gridRows,
        gridCols,
      };
      const result = await updateLocationAction(mode.node.id, input);
      if (result.success) {
        toast.success("已保存");
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    }
  }

  const title =
    mode.mode === "edit"
      ? `编辑${LEVEL_LABEL[targetLevel]}`
      : `新增${LEVEL_LABEL[targetLevel]}${
          mode.mode === "create" && mode.defaultName
            ? ` @ ${mode.defaultName}`
            : ""
        }`;

  const subline =
    mode.mode === "create"
      ? mode.parentLevel
        ? `层级：${LEVEL_LABEL[targetLevel]}（位于 ${LEVEL_LABEL[mode.parentLevel]} 之下）`
        : `层级：${LEVEL_LABEL[targetLevel]}`
      : `层级：${LEVEL_LABEL[targetLevel]}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-md overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{subline}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id="location-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            {mode.mode === "create" &&
              targetLevel === "SLOT" &&
              typeof mode.position === "number" && (
                <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">位置：</span>
                  <span className="font-medium">
                    {mode.defaultName ?? `#${mode.position}`}
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    （已锁定，由网格点击决定）
                  </span>
                </div>
              )}

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>名称 *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={
                        targetLevel === "TANK"
                          ? "如：液氮罐A 或 -80℃冰箱1"
                          : targetLevel === "CANISTER"
                            ? "如：提筒1"
                            : targetLevel === "BOX"
                              ? "如：盒1"
                              : "默认与位置标识一致，可改"
                      }
                      {...field}
                    />
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
                  <FormLabel>编码</FormLabel>
                  <FormControl>
                    <Input placeholder="选填" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {targetLevel === "BOX" && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="gridRows"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>行数 *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={50}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="gridCols"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>列数 *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={50}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <p className="col-span-2 text-xs text-muted-foreground">
                  容量自动计算 = 行数 × 列数
                </p>
              </div>
            )}
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
            form="location-form"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
