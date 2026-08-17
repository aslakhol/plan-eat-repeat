import { randomUUID } from "node:crypto";

import { type PrismaClient } from "@planeatrepeat/db";

import {
  publicSlugForDinner,
  toPublishedDinner,
  type PublishedDinner,
} from "~/lib/published-dinner";

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
  Household: { select: { name: true } },
  tags: { orderBy: { value: "asc" as const } },
  parts: {
    orderBy: { order: "asc" as const },
    include: {
      ingredients: { orderBy: { order: "asc" as const } },
      steps: { orderBy: { order: "asc" as const } },
    },
  },
};

export const findPublishedDinner = async (
  db: PrismaClient,
  publicSlug: string,
): Promise<PublishedDinner | null> => {
  const dinner = await db.dinner.findUnique({
    where: { publicSlug },
    include: publishedDinnerInclude,
  });

  if (!dinner?.publicSlug || !dinner.publishedAt) return null;
  return toPublishedDinner({
    ...dinner,
    publicSlug: dinner.publicSlug,
    publishedAt: dinner.publishedAt,
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
