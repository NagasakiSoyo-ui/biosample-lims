import { auth } from "@/lib/auth";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type Actor = {
  id: string;
  role: UserRole;
  name: string;
  projectIds: string[] | null;
};

// Returns the current user when present; null otherwise.
// Server Actions wrap this in their { success, error } envelope rather than
// throwing, so the client always gets a typed result.
export async function getActor(): Promise<Actor | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      role: true,
      name: true,
      isActive: true,
      projectAccess: { select: { projectId: true } },
    },
  });
  if (!user?.isActive) return null;
  return {
    id: user.id,
    role: user.role,
    name: user.name,
    projectIds:
      user.role === "ADMIN"
        ? null
        : user.projectAccess.map((grant) => grant.projectId),
  };
}

export function canAccessProject(actor: Actor, projectId: string): boolean {
  return actor.projectIds === null || actor.projectIds.includes(projectId);
}

export function projectWhere(actor: Actor) {
  return actor.projectIds === null ? {} : { id: { in: actor.projectIds } };
}

export function sampleWhere(actor: Actor) {
  return actor.projectIds === null
    ? {}
    : { projectId: { in: actor.projectIds } };
}

export function donorWhere(actor: Actor) {
  return actor.projectIds === null
    ? {}
    : { projectId: { in: actor.projectIds } };
}
