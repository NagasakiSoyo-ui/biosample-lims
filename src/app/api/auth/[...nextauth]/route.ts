import { handlers } from "@/lib/auth";

// NextAuth v5 returns an object { GET, POST } — re-export as route handlers.
export const { GET, POST } = handlers;
