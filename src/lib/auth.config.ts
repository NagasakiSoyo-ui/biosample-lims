import type { NextAuthConfig } from "next-auth";

// Edge-safe NextAuth config: no Prisma, no bcryptjs imports here.
// Used by middleware (Edge runtime) and extended by src/lib/auth.ts.
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  trustHost: true,
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = nextUrl.pathname === "/login";
      if (isOnLogin) {
        return isLoggedIn ? Response.redirect(new URL("/", nextUrl)) : true;
      }
      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id;
      if (token.role) session.user.role = token.role;
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
