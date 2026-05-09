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
  createProjectAction,
  updateProjectAction,
  type ProjectInput,
} from "@/server/actions/projects";

const formSchema = z.object({
  name: z.string().min(1, "名称不能为空"),
  code: z
    .string()
    .min(1, "缩写不能为空")
    .regex(
      /^[A-Z][A-Z0-9_-]*$/,
      "缩写只能为大写字母、数字、下划线、连字符",
    ),
  purpose: z.enum(["RESEARCH", "CLINICAL_INFUSION"]),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export type ProjectForEdit = {
  id: string;
  name: string;
  code: string;
  purpose: "RESEARCH" | "CLINICAL_INFUSION";
  description: string | null;
};

export function ProjectFormDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: ProjectForEdit | null;
}) {
  const isEdit = !!editing;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      code: "",
      purpose: "RESEARCH",
      description: "",
    },
  });

  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      form.reset({
        name: editing.name,
        code: editing.code,
        purpose: editing.purpose,
        description: editing.description ?? "",
      });
    } else {
      form.reset({
        name: "",
        code: "",
        purpose: "RESEARCH",
        description: "",
      });
    }
  }, [open, editing, form]);

  async function onSubmit(values: FormValues) {
    const input: ProjectInput = {
      name: values.name,
      code: values.code,
      purpose: values.purpose,
      description: values.description || undefined,
    };
    const result = isEdit
      ? await updateProjectAction(editing!.id, input)
      : await createProjectAction(input);
    if (result.success) {
      toast.success(isEdit ? "已保存" : "已创建");
      onOpenChange(false);
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-lg overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "编辑项目" : "新增项目"}</DialogTitle>
          <DialogDescription>
            缩写用作样本编号前缀，修改后不影响已生成的样本编号。
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id="project-form"
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
                    <Input placeholder="如：GBM-TIL 研究" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>缩写 *</FormLabel>
                    <FormControl>
                      <Input placeholder="如：GBM" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="purpose"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>类型 *</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      items={{
                        RESEARCH: "研究",
                        CLINICAL_INFUSION: "临床回输",
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="RESEARCH">研究</SelectItem>
                        <SelectItem value="CLINICAL_INFUSION">
                          临床回输
                        </SelectItem>
                      </SelectContent>
                    </Select>
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
                      rows={3}
                      placeholder="选填：项目背景、目标等"
                      {...field}
                    />
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
            form="project-form"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
