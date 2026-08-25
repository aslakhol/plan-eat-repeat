import { type PrismaClient } from "@planeatrepeat/db";

import { type PublicDinnerList } from "~/lib/public-dinner-list";

export const findPublicDinnerListSitemapSlugs = async (db: PrismaClient) => {
  const households = await db.household.findMany({
    where: {
      publicSlug: { not: null },
      Dinners: {
        some: { publicSlug: { not: null }, publishedAt: { not: null } },
      },
    },
    select: { publicSlug: true },
    orderBy: { publicSlug: "asc" },
  });

  return households.flatMap((household) =>
    household.publicSlug ? [household.publicSlug] : [],
  );
};

export const findPublicDinnerList = async (
  db: PrismaClient,
  publicSlug: string,
): Promise<PublicDinnerList | null> => {
  const household = await db.household.findUnique({
    where: { publicSlug },
    select: {
      id: true,
      name: true,
      publicSlug: true,
      Dinners: {
        where: {
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
      },
    },
  });

  if (!household?.publicSlug || household.Dinners.length === 0) return null;

  const destinationHouseholds = await db.dinner.groupBy({
    by: ["sourceDinnerId", "householdId"],
    where: {
      sourceDinnerId: { in: household.Dinners.map((dinner) => dinner.id) },
      householdId: { not: household.id },
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

  return {
    publicSlug: household.publicSlug,
    householdName: household.name,
    dinners: household.Dinners.map((dinner) => ({
      name: dinner.name,
      publicSlug: dinner.publicSlug!,
      publishedAt: dinner.publishedAt!.toISOString(),
      saveCount: saveCounts.get(dinner.id) ?? 0,
      tags: dinner.tags.map((tag) => tag.value),
    })),
  };
};
