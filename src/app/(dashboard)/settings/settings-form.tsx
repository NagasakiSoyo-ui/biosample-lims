"use client";

import * as React from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { changeOwnPasswordAction } from "@/server/actions/users";

export function SettingsForm({
  profile,
}: {
  profile: { email: string; name: string; role: "ADMIN" | "USER" };
}) {
  const [oldPwd, setOldPwd] = React.useState("");
  const [newPwd, setNewPwd] = React.useState("");
  const [confirmPwd, setConfirmPwd] = React.useState("");
  const [pending, setPending] = React.useState(false);

  async function submit() {
    if (!oldPwd) return toast.error("请输入当前密码");
    if (newPwd.length < 8) return toast.error("新密码至少 8 位");
    if (newPwd !== confirmPwd) return toast.error("两次输入的新密码不一致");
    setPending(true);
    const result = await changeOwnPasswordAction({
      oldPassword: oldPwd,
      newPassword: newPwd,
    });
    setPending(false);
    if (result.success) {
      toast.success("密码已修改");
      setOldPwd("");
      setNewPwd("");
      setConfirmPwd("");
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">账号信息</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <span className="text-muted-foreground">邮箱：</span>
            <span className="font-mono">{profile.email}</span>
          </div>
          <div>
            <span className="text-muted-foreground">姓名：</span>
            <span>{profile.name}</span>
          </div>
          <div>
            <span className="text-muted-foreground">角色：</span>
            {profile.role === "ADMIN" ? (
              <Badge>管理员</Badge>
            ) : (
              <Badge variant="secondary">普通用户</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            邮箱、姓名、角色由管理员在用户管理页修改。
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">修改密码</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>当前密码</Label>
            <Input
              type="password"
              value={oldPwd}
              onChange={(e) => setOldPwd(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>新密码（至少 8 位）</Label>
            <Input
              type="password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>确认新密码</Label>
            <Input
              type="password"
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
            />
          </div>
          <Button type="button" onClick={submit} disabled={pending}>
            {pending ? "提交中..." : "更新密码"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
