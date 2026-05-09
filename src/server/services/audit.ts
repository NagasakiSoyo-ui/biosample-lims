import { Prisma } from "@prisma/client";

type AuditArgs = {
  userId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  changes?: { before?: unknown; after?: unknown } | null;
};

// Build the data payload for an AuditLog.create() call inside a $transaction.
// CLAUDE.md mandates main-mutation + audit-row in the same transaction.
export function buildAuditData(
  args: AuditArgs,
): Prisma.AuditLogUncheckedCreateInput {
  return {
    userId: args.userId,
    action: args.action,
    entityType: args.entityType,
    entityId: args.entityId ?? null,
    changes: args.changes
      ? (args.changes as unknown as Prisma.InputJsonValue)
      : Prisma.JsonNull,
  };
}
