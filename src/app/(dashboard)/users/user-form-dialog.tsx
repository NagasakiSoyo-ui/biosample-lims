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
  type UpdateUserInput,
} from "@/server/actions/users";

export type UserForEdit = {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "USER";
};

const createSchema = z.object({
  email: z.string().email("请输入有效的邮箱"),
  name: z.string().min(1, "姓名不能为空"),
  role: z.enum(["ADMIN", "USER"]),
  password: z.string().min(8, "密码至少 8 位"),
});
type CreateValues = z.infer<typeof createSchema>;

const editSchema = z.object({
  name: z.string().min(1, "姓名不能为空"),
  role: z.enum(["ADMIN", "USER"]),
});
type EditValues = z.infer<typeof editSchema>;

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

  const createForm = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { email: "", name: "", role: "USER", password: "" },
  });
  const editForm = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { name: "", role: "USER" },
  });

  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      editForm.reset({ name: editing.name, role: editing.role });
    } else {
      createForm.reset({ email: "", name: "", role: "USER", password: "" });
    }
  }, [open, editing, createForm, editForm]);

  async function onCreate(values: CreateValues) {
    const input: CreateUserInput = values;
    const result = await createUserAction(input);
    if (result.success) {
      toast.success("已创建");
      onOpenChange(false);
    } else {
      toast.error(result.error);
    }
  }

  async function onEdit(values: EditValues) {
    if (!editing) return;
    const input: UpdateUserInput = values;
    const result = await updateUserAction(editing.id, input);
    if (result.success) {
      toast.success("已保存");
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

        {isEdit ? (
          <Form {...editForm}>
            <form
              id="user-edit-form"
              onSubmit={editForm.handleSubmit(onEdit)}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <FormLabel>邮箱</FormLabel>
                <Input value={editing!.email} disabled />
              </div>
              <FormField
                control={editForm.control}
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
                control={editForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>角色 *</FormLabel>
                    <div className="flex gap-4 pt-1">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          checked={field.value === "ADMIN"}
                          onChange={() => field.onChange("ADMIN")}
                        />
                        管理员
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
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
            </form>
          </Form>
        ) : (
          <Form {...createForm}>
            <form
              id="user-create-form"
              onSubmit={createForm.handleSubmit(onCreate)}
              className="space-y-4"
            >
              <FormField
                control={createForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>邮箱 *</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="user@example.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
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
                control={createForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>角色 *</FormLabel>
                    <div className="flex gap-4 pt-1">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          checked={field.value === "ADMIN"}
                          onChange={() => field.onChange("ADMIN")}
                        />
                        管理员
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
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
              <FormField
                control={createForm.control}
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
            </form>
          </Form>
        )}

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
            onClick={
              isEdit
                ? editForm.handleSubmit(onEdit)
                : createForm.handleSubmit(onCreate)
            }
            disabled={
              isEdit ? editForm.formState.isSubmitting : createForm.formState.isSubmitting
            }
          >
            {(isEdit ? editForm.formState.isSubmitting : createForm.formState.isSubmitting)
              ? "保存中..."
              : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
