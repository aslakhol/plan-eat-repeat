import { type PrismaClient } from "@planeatrepeat/db";

import { type PublicDinnerList } from "~/lib/public-dinner-list";

export const findPublicDinnerList = async (
  db: PrismaClient,
  publicSlug: string,
): Promise<PublicDinnerList | null> => {
  const household = await db.household.findUnique({
    where: { publicSlug },
    select: {
      name: true,
      publicSlug: true,
      Dinners: {
        where: {
          publicSlug: { not: null },
          publishedAt: { not: null },
        },
        select: {
          name: true,
          publicSlug: true,
          tags: { select: { value: true }, orderBy: { value: "asc" } },
        },
        orderBy: [{ publishedAt: "desc" }, { name: "asc" }, { id: "asc" }],
      },
    },
  });

  if (!household?.publicSlug || household.Dinners.length === 0) return null;

  return {
    publicSlug: household.publicSlug,
    householdName: household.name,
    dinners: household.Dinners.map((dinner) => ({
      name: dinner.name,
      publicSlug: dinner.publicSlug!,
      tags: dinner.tags.map((tag) => tag.value),
    })),
  };
};
