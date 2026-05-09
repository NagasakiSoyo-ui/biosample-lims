"use server";

import { AuthError } from "next-auth";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { z } from "zod";
import { signIn, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const loginSchema = z.object({
  email: z.string().email("请输入有效的邮箱"),
  password: z.string().min(1, "请输入密码"),
});

export type LoginState = {
  success: boolean;
  error?: string;
  email?: string;
} | null;

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const raw = {
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "输入有误",
      email: raw.email,
    };
  }

  // Pre-flight: surface "账号已停用" with a friendlier message than NextAuth's
  // generic CredentialsSignin. (authorize() also re-checks; this is defense in
  // depth.)
  const account = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { isActive: true },
  });
  if (account && !account.isActive) {
    return {
      success: false,
      error: "账号已停用，请联系管理员",
      email: raw.email,
    };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/",
    });
    // Unreachable: signIn throws NEXT_REDIRECT on success.
    return { success: true };
  } catch (error) {
    // CRITICAL: NEXT_REDIRECT must propagate so the framework navigates.
    if (isRedirectError(error)) throw error;

    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin") {
        return { success: false, error: "邮箱或密码错误", email: raw.email };
      }
      return { success: false, error: "登录失败，请稍后重试", email: raw.email };
    }
    throw error;
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
