import { randomUUID } from "node:crypto";

import type { Prisma, PrismaClient } from "@planeatrepeat/db";

import {
  publicSlugForDinner,
  toPublishedDinner,
  type PublishedDinner,
} from "~/lib/published-dinner";
import { publicSlugForHousehold } from "~/lib/public-dinner-list";

const PUBLICATION_BURST_WINDOW_MS = 10_000;
const PUBLICATION_BURST_LIMIT = 20;

const publishedDinnerIdentitySelect = {
  id: true,
  name: true,
  publicSlug: true,
  publishedAt: true,
};

export class PublicationRateLimitError extends Error {}

const publishedDinnerInclude = {
  Household: { select: { name: true, publicSlug: true } },
  tags: { orderBy: { value: "asc" as const } },
  parts: {
    orderBy: { order: "asc" as const },
    include: {
      ingredients: { orderBy: { order: "asc" as const } },
      steps: { orderBy: { order: "asc" as const } },
    },
  },
};

const ensureHouseholdPublicSlug = async (
  tx: Prisma.TransactionClient,
  householdId: string,
) => {
  const household = await tx.household.findUnique({
    where: { id: householdId },
    select: { name: true, publicSlug: true },
  });
  if (!household || household.publicSlug) return household?.publicSlug ?? null;

  const publicSlug = publicSlugForHousehold(
    household.name,
    randomUUID().replaceAll("-", "").slice(0, 12),
  );
  await tx.household.update({
    where: { id: householdId },
    data: { publicSlug },
  });
  return publicSlug;
};

export const findPublishedDinner = async (
  db: PrismaClient,
  publicSlug: string,
): Promise<PublishedDinner | null> => {
  const dinner = await db.dinner.findUnique({
    where: { publicSlug },
    include: publishedDinnerInclude,
  });

  if (
    !dinner?.publicSlug ||
    !dinner.publishedAt ||
    !dinner.Household.publicSlug
  )
    return null;
  return toPublishedDinner({
    ...dinner,
    publicSlug: dinner.publicSlug,
    publishedAt: dinner.publishedAt,
    Household: {
      name: dinner.Household.name,
      publicSlug: dinner.Household.publicSlug,
    },
  });
};

export const findPublishedDinnerSitemapSlugs = async (db: PrismaClient) => {
  const dinners = await db.dinner.findMany({
    where: { publicSlug: { not: null }, publishedAt: { not: null } },
    select: { publicSlug: true },
    orderBy: { publicSlug: "asc" },
  });

  return dinners.flatMap((dinner) =>
    dinner.publicSlug ? [dinner.publicSlug] : [],
  );
};

export const findPublishedDinnerSaveCount = async (
  db: PrismaClient,
  householdId: string,
  dinnerId: number,
) => {
  const source = await db.dinner.findUnique({
    where: { id: dinnerId, householdId },
    select: { id: true },
  });
  if (!source) return null;

  const destinationHouseholds = await db.dinner.groupBy({
    by: ["householdId"],
    where: {
      sourceDinnerId: source.id,
      householdId: { not: householdId },
    },
  });

  return destinationHouseholds.length;
};

export const findSharedDinners = async (
  db: PrismaClient,
  householdId: string,
) => {
  const dinners = await db.dinner.findMany({
    where: {
      householdId,
      publicSlug: { not: null },
      publishedAt: { not: null },
    },
    select: {
      id: true,
      name: true,
      publicSlug: true,
      publishedAt: true,
      tags: { select: { value: true }, orderBy: { value: "asc" } },
    },
    orderBy: [{ publishedAt: "desc" }, { name: "asc" }, { id: "asc" }],
  });

  if (dinners.length === 0) return [];

  const destinationHouseholds = await db.dinner.groupBy({
    by: ["sourceDinnerId", "householdId"],
    where: {
      sourceDinnerId: { in: dinners.map((dinner) => dinner.id) },
      householdId: { not: householdId },
    },
  });
  const saveCounts = new Map<number, number>();
  for (const copy of destinationHouseholds) {
    if (copy.sourceDinnerId === null) continue;
    saveCounts.set(
      copy.sourceDinnerId,
      (saveCounts.get(copy.sourceDinnerId) ?? 0) + 1,
    );
  }

  return dinners.map((dinner) => ({
    ...dinner,
    publicSlug: dinner.publicSlug!,
    publishedAt: dinner.publishedAt!,
    saveCount: saveCounts.get(dinner.id) ?? 0,
  }));
};

export const publishDinner = async (
  db: PrismaClient,
  householdId: string,
  dinnerId: number,
  now = new Date(),
) =>
  db.$transaction(async (tx) => {
    const dinner = await tx.dinner.findUnique({
      where: { id: dinnerId, householdId },
      select: publishedDinnerIdentitySelect,
    });

    if (!dinner) return null;
    if (dinner.publicSlug && dinner.publishedAt) return dinner;

    // Serialize the check and update for one Household so concurrent requests
    // cannot all observe the same pre-publication count.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${householdId}))`;

    const recentPublicationCount = await tx.dinner.count({
      where: {
        householdId,
        publishedAt: {
          gte: new Date(now.getTime() - PUBLICATION_BURST_WINDOW_MS),
        },
      },
    });
    if (recentPublicationCount >= PUBLICATION_BURST_LIMIT) {
      throw new PublicationRateLimitError(
        "Too many Dinners were published at once. Try again shortly.",
      );
    }

    await ensureHouseholdPublicSlug(tx, householdId);

    if (dinner.publicSlug) {
      return tx.dinner.update({
        where: { id: dinner.id, householdId },
        data: { publishedAt: now },
        select: publishedDinnerIdentitySelect,
      });
    }

    const publicSlug = publicSlugForDinner(
      dinner.name,
      randomUUID().replaceAll("-", "").slice(0, 12),
    );
    const claimed = await tx.dinner.updateMany({
      where: { id: dinner.id, householdId, publicSlug: null },
      data: { publicSlug, publishedAt: now },
    });

    if (claimed.count === 1) {
      return { ...dinner, publicSlug, publishedAt: now };
    }

    return tx.dinner.findUnique({
      where: { id: dinner.id, householdId },
      select: publishedDinnerIdentitySelect,
    });
  });

export const stopDinnerPublication = async (
  db: PrismaClient,
  householdId: string,
  dinnerId: number,
) => {
  const stopped = await db.dinner.updateMany({
    where: {
      id: dinnerId,
      householdId,
      publishedAt: { not: null },
    },
    data: { publishedAt: null },
  });

  return stopped.count === 1;
};
