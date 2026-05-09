import { Prisma, type LocationLevel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildAuditData } from "./audit";

export const LEVEL_ORDER: LocationLevel[] = [
  "TANK",
  "CANISTER",
  "BOX",
  "SLOT",
];

export const LEVEL_LABEL: Record<LocationLevel, string> = {
  TANK: "罐 / 冰箱",
  CANISTER: "提筒",
  BOX: "冻存盒",
  SLOT: "孔位",
};

export const LEVEL_ICON: Record<LocationLevel, string> = {
  TANK: "🏛️",
  CANISTER: "📦",
  BOX: "🗃️",
  SLOT: "🔹",
};

// Returns the level a child must be when added under a parent of the given
// level. `null` parent (top-level) yields TANK. SLOT yields `null` (no child
// allowed).
export function childLevelOf(
  parentLevel: LocationLevel | null,
): LocationLevel | null {
  if (parentLevel === null) return "TANK";
  const idx = LEVEL_ORDER.indexOf(parentLevel);
  if (idx === -1 || idx === LEVEL_ORDER.length - 1) return null;
  return LEVEL_ORDER[idx + 1];
}

// Convert a 0-based column index to Excel-style letters (0→A, 25→Z, 26→AA…).
function toColumnLetters(n: number): string {
  let result = "";
  let num = n;
  while (num >= 0) {
    result = String.fromCharCode(65 + (num % 26)) + result;
    num = Math.floor(num / 26) - 1;
  }
  return result;
}

// Position is the 0-based linear index inside a BOX (row*cols + col).
// cellLabel(0, 10)  → "A1"
// cellLabel(9, 10)  → "A10"
// cellLabel(10, 10) → "B1"
export function cellLabel(position: number, cols: number): string {
  const row = Math.floor(position / cols);
  const col = position % cols;
  return `${toColumnLetters(row)}${col + 1}`;
}

// Inverse of cellLabel. Parses "A3" / "AA10" → position. Returns null on bad
// input or out-of-range column letters.
export function parseCellLabel(label: string, cols: number): number | null {
  const m = label.trim().match(/^([A-Za-z]+)(\d+)$/);
  if (!m) return null;
  const letters = m[1].toUpperCase();
  const colIdxNumber = Number(m[2]);
  if (!Number.isInteger(colIdxNumber) || colIdxNumber < 1 || colIdxNumber > cols) {
    return null;
  }
  // Excel-style letter to row index: A=0, Z=25, AA=26, ...
  let row = 0;
  for (let i = 0; i < letters.length; i++) {
    row = row * 26 + (letters.charCodeAt(i) - 64);
  }
  row -= 1;
  if (row < 0) return null;
  return row * cols + (colIdxNumber - 1);
}

// Find a SLOT in a BOX by position; create one with name=cellLabel if absent.
// Returns the SLOT and whether it was newly created. Must be called inside a
// transaction so the audit row stays atomic.
export async function getOrCreateSlot(
  tx: Prisma.TransactionClient,
  args: { boxId: string; position: number; actorId: string },
): Promise<{ id: string; name: string; position: number; isNew: boolean }> {
  const box = await tx.location.findUnique({
    where: { id: args.boxId },
    select: { id: true, level: true, capacity: true, gridCols: true },
  });
  if (!box || box.level !== "BOX") {
    throw new Error("INVALID_BOX");
  }
  if (box.capacity == null || args.position < 0 || args.position >= box.capacity) {
    throw new Error("POSITION_OUT_OF_RANGE");
  }
  const existing = await tx.location.findFirst({
    where: { parentId: args.boxId, position: args.position },
  });
  if (existing) {
    return {
      id: existing.id,
      name: existing.name,
      position: existing.position!,
      isNew: false,
    };
  }
  const name = cellLabel(args.position, box.gridCols ?? 10);
  const created = await tx.location.create({
    data: {
      name,
      level: "SLOT",
      parentId: args.boxId,
      position: args.position,
    },
  });
  await tx.auditLog.create({
    data: buildAuditData({
      userId: args.actorId,
      action: "AUTO_CREATE_SLOT",
      entityType: "Location",
      entityId: created.id,
      changes: { after: created },
    }),
  });
  return { id: created.id, name: created.name, position: args.position, isNew: true };
}

// True when another sample currently occupies the SLOT. When editing a
// sample's location, pass excludeSampleId so the sample doesn't count itself.
export async function isSlotOccupied(
  client: Prisma.TransactionClient | typeof prisma,
  slotId: string,
  excludeSampleId?: string,
): Promise<boolean> {
  const count = await client.sample.count({
    where: {
      locationId: slotId,
      ...(excludeSampleId ? { NOT: { id: excludeSampleId } } : {}),
      status: { notIn: ["DEPLETED", "DISCARDED", "VOIDED", "RELEASED"] },
    },
  });
  return count > 0;
}

// Walk up the parent chain to build "TANK > CANISTER > BOX > SLOT".
// Caps at 8 hops to be safe.
export async function getLocationPath(
  client: Prisma.TransactionClient | typeof prisma,
  locationId: string,
): Promise<string> {
  const parts: string[] = [];
  let id: string | null = locationId;
  for (let i = 0; id && i < 8; i++) {
    const node: { name: string; parentId: string | null } | null =
      await client.location.findUnique({
        where: { id },
        select: { name: true, parentId: true },
      });
    if (!node) break;
    parts.unshift(node.name);
    id = node.parentId;
  }
  return parts.join(" > ");
}
