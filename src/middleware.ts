import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

export const { auth: middleware } = NextAuth(authConfig);

// Run middleware on everything except Next internals, static assets, and the
// NextAuth route handlers themselves. The /login redirect is handled inside
// the `authorized` callback in auth.config.ts.
export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
