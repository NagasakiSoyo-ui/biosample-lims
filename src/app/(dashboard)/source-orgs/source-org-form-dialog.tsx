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
  createSourceOrgAction,
  updateSourceOrgAction,
  type SourceOrgInput,
} from "@/server/actions/source-orgs";

const formSchema = z.object({
  name: z.string().min(1, "名称不能为空"),
  type: z.string().optional(),
  contactPerson: z.string().optional(),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export type SourceOrgForEdit = {
  id: string;
  name: string;
  type: string | null;
  contactPerson: string | null;
  contactPhone: string | null;
  address: string | null;
  notes: string | null;
};

export function SourceOrgFormDialog({
  open,
  onOpenChange,
  editing,
  existingTypes,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: SourceOrgForEdit | null;
  existingTypes: string[];
}) {
  const isEdit = !!editing;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      type: "",
      contactPerson: "",
      contactPhone: "",
      address: "",
      notes: "",
    },
  });

  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      form.reset({
        name: editing.name,
        type: editing.type ?? "",
        contactPerson: editing.contactPerson ?? "",
        contactPhone: editing.contactPhone ?? "",
        address: editing.address ?? "",
        notes: editing.notes ?? "",
      });
    } else {
      form.reset({
        name: "",
        type: "",
        contactPerson: "",
        contactPhone: "",
        address: "",
        notes: "",
      });
    }
  }, [open, editing, form]);

  async function onSubmit(values: FormValues) {
    const input: SourceOrgInput = values;
    const result = isEdit
      ? await updateSourceOrgAction(editing!.id, input)
      : await createSourceOrgAction(input);
    if (result.success) {
      toast.success(isEdit ? "已保存" : "已创建");
      onOpenChange(false);
    } else {
      toast.error(result.error);
    }
  }

  const suggestedTypes = ["医院", "高校", "合作机构", "内部", "其他"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-lg overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "编辑来源单位" : "新增来源单位"}</DialogTitle>
          <DialogDescription>样本提供方的基本资料与联系方式。</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id="source-org-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>名称 *</FormLabel>
                  <FormControl>
                    <Input placeholder="如：上海某三甲医院" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>类型</FormLabel>
                  <FormControl>
                    <Input
                      list="source-org-types"
                      placeholder="如：医院 / 高校 / 合作机构 / 内部"
                      {...field}
                    />
                  </FormControl>
                  <datalist id="source-org-types">
                    {Array.from(new Set([...suggestedTypes, ...existingTypes])).map(
                      (t) => (
                        <option key={t} value={t} />
                      ),
                    )}
                  </datalist>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="contactPerson"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>联系人</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contactPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>联系电话</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>地址</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
            form="source-org-form"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
