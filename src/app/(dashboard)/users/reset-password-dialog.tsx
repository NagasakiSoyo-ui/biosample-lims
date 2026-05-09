"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { resetUserPasswordAction } from "@/server/actions/users";

export function ResetPasswordDialog({
  open,
  onOpenChange,
  userId,
  userEmail,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string | null;
  userEmail: string | null;
}) {
  const [pwd, setPwd] = React.useState("");
  const [confirmPwd, setConfirmPwd] = React.useState("");
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setPwd("");
      setConfirmPwd("");
      setConfirmOpen(false);
    }
  }, [open]);

  function tryConfirm() {
    if (pwd.length < 8) return toast.error("新密码至少 8 位");
    if (pwd !== confirmPwd) return toast.error("两次输入的密码不一致");
    setConfirmOpen(true);
  }

  async function doReset() {
    if (!userId) return;
    setPending(true);
    const result = await resetUserPasswordAction(userId, { newPassword: pwd });
    setPending(false);
    if (result.success) {
      toast.success("密码已重置");
      setConfirmOpen(false);
      onOpenChange(false);
    } else {
      toast.error(result.error);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] w-[95vw] max-w-md overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>重置密码</DialogTitle>
            <DialogDescription>
              {userEmail ? `用户：${userEmail}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>新密码（至少 8 位）</Label>
              <Input
                type="password"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
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
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button type="button" onClick={tryConfirm} disabled={pending}>
              重置
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="二次确认"
        description={`确认将「${userEmail ?? ""}」的密码重置为新密码？此操作会立即生效。`}
        destructive
        loading={pending}
        confirmLabel="确认重置"
        onConfirm={doReset}
      />
    </>
  );
}
