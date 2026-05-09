import { auth } from "@/lib/auth";
import type { UserRole } from "@prisma/client";

export type Actor = {
  id: string;
  role: UserRole;
  name: string;
};

// Returns the current user when present; null otherwise.
// Server Actions wrap this in their { success, error } envelope rather than
// throwing, so the client always gets a typed result.
export async function getActor(): Promise<Actor | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    role: session.user.role,
    name: session.user.name ?? "",
  };
}
