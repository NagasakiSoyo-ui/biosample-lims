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
import { Button } from "@/components/ui/button";
import {
  createUserAction,
  updateUserAction,
  type CreateUserInput,
} from "@/server/actions/users";

export type UserForEdit = {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "USER";
};

const formSchema = z.object({
  email: z.string().email("请输入有效的邮箱"),
  name: z.string().min(1, "姓名不能为空").max(50, "姓名过长"),
  role: z.enum(["ADMIN", "USER"]),
  // Required field type-wise; create-mode length is enforced in onSubmit.
  password: z.string(),
});
type FormValues = z.infer<typeof formSchema>;

export function UserFormDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: UserForEdit | null;
}) {
  const isEdit = !!editing;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", name: "", role: "USER", password: "" },
  });

  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      form.reset({
        email: editing.email,
        name: editing.name,
        role: editing.role,
        password: "",
      });
    } else {
      form.reset({ email: "", name: "", role: "USER", password: "" });
    }
  }, [open, editing, form]);

  async function onSubmit(values: FormValues) {
    if (isEdit && editing) {
      const result = await updateUserAction(editing.id, {
        name: values.name,
        role: values.role,
      });
      if (result.success) {
        toast.success("已保存");
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
      return;
    }

    // Create mode — password is required and must be ≥ 8 chars.
    if (!values.password || values.password.length < 8) {
      form.setError("password", { message: "密码至少 8 位" });
      return;
    }
    const input: CreateUserInput = {
      email: values.email,
      name: values.name,
      role: values.role,
      password: values.password,
    };
    const result = await createUserAction(input);
    if (result.success) {
      toast.success("已创建");
      onOpenChange(false);
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-md overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "编辑用户" : "新增用户"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "邮箱不可修改。如需重置密码，请使用「重置密码」按钮。"
              : "新用户首次登录后请尽快修改密码。"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id="user-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>邮箱 *</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="user@example.com"
                      disabled={isEdit}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>姓名 *</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>角色 *</FormLabel>
                  <div className="flex gap-4 pt-1">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="role"
                        checked={field.value === "ADMIN"}
                        onChange={() => field.onChange("ADMIN")}
                      />
                      管理员
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="role"
                        checked={field.value === "USER"}
                        onChange={() => field.onChange("USER")}
                      />
                      普通用户
                    </label>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            {!isEdit && (
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>初始密码 *（至少 8 位）</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
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
            type="button"
            onClick={form.handleSubmit(onSubmit)}
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
