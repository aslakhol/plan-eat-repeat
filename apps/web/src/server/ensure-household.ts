import { randomUUID } from "node:crypto";
import type { Prisma } from "@planeatrepeat/db";
import { householdSlugBase } from "~/lib/household";

export const defaultHouseholdName = (user: {
  firstName: string | null;
  lastName: string | null;
}) => {
  const name = [user.firstName, user.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  return name ? `${name}'s household` : "My household";
};

// Share this lock with first-time recipe saves so simultaneous entry points
// cannot create two households for the same user.
export async function ensureHousehold(
  tx: Prisma.TransactionClient,
  userId: string,
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`published-dinner-save-user:${userId}`}))`;
  const membership = await tx.membership.findUnique({
    where: { userId },
    select: { householdId: true },
  });
  if (membership) return membership.householdId;

  const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
  const name = defaultHouseholdName(user);
  const household = await tx.household.create({
    data: {
      name,
      slug: `${householdSlugBase(name)}-${randomUUID().slice(0, 8)}`,
      Members: { create: { userId, role: "ADMIN" } },
    },
    select: { id: true },
  });
  return household.id;
}
