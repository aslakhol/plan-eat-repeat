import { randomUUID } from "node:crypto";

import { type Prisma, type PrismaClient } from "@planeatrepeat/db";

const SAVE_BURST_WINDOW_MS = 10_000;
const SAVE_BURST_LIMIT = 20;

export class PublishedDinnerSaveRateLimitError extends Error {}

class PublishedDinnerUnavailableRollback extends Error {}

export const publishedDinnerSaveHouseholdName = (user: {
  firstName: string | null;
  lastName: string | null;
}) => {
  const name = [user.firstName, user.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  return name ? `${name}'s household` : "My household";
};

const publishedDinnerSaveHouseholdSlug = (name: string) => {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
  return `${base || "household"}-${randomUUID().slice(0, 8)}`;
};

export const reconcilePublishedDinnerTags = (
  sourceTags: string[],
  destinationTags: string[],
) => {
  const destinationTagByKey = new Map<string, string>();
  for (const tag of destinationTags) {
    const key = tag.toLowerCase();
    if (!destinationTagByKey.has(key)) destinationTagByKey.set(key, tag);
  }

  const matched = new Map<string, string>();
  for (const sourceTag of sourceTags) {
    const key = sourceTag.toLowerCase();
    const destinationTag = destinationTagByKey.get(key);
    if (destinationTag) matched.set(key, destinationTag);
  }
  return [...matched.values()];
};

export const matchesPublishedDinnerSource = (
  dinner: { id: number; sourceDinnerId: number | null },
  sourceDinnerId: number,
) => dinner.id === sourceDinnerId || dinner.sourceDinnerId === sourceDinnerId;

type PublishedDinnerCopySource = {
  id: number;
  name: string;
  link: string | null;
  notes: string | null;
  servings: number | null;
  tags: Array<{ value: string }>;
  parts: Array<{
    name: string | null;
    order: number;
    ingredients: Array<{
      name: string;
      amount: number | null;
      unit: string | null;
      note: string | null;
      order: number;
    }>;
    steps: Array<{ text: string; order: number }>;
  }>;
};

export const projectPublishedDinnerCopy = <T extends PublishedDinnerCopySource>(
  source: T,
  destinationHouseholdId: string,
  destinationTags: string[],
) => ({
  name: source.name,
  householdId: destinationHouseholdId,
  link: source.link,
  notes: source.notes,
  servings: source.servings,
  sourceDinnerId: source.id,
  tags: {
    connect: reconcilePublishedDinnerTags(
      source.tags.map((tag) => tag.value),
      destinationTags,
    ).map((value) => ({ value })),
  },
  parts: {
    create: source.parts.map((part, partIndex) => ({
      name: part.name,
      order: partIndex,
      ingredients: {
        create: part.ingredients.map((ingredient, ingredientIndex) => ({
          name: ingredient.name,
          amount: ingredient.amount,
          unit: ingredient.unit,
          note: ingredient.note,
          order: ingredientIndex,
        })),
      },
      steps: {
        create: part.steps.map((step, stepIndex) => ({
          text: step.text,
          order: stepIndex,
        })),
      },
    })),
  },
});

const publishedDinnerCopyInclude = {
  tags: { orderBy: { value: "asc" as const } },
  parts: {
    orderBy: { order: "asc" as const },
    include: {
      ingredients: { orderBy: { order: "asc" as const } },
      steps: { orderBy: { order: "asc" as const } },
    },
  },
};

const matchingSavedDinnerWhere = (
  householdId: string,
  sourceDinnerId: number,
) => ({
  householdId,
  OR: [{ id: sourceDinnerId }, { sourceDinnerId }],
});

const activePublishedDinnerWhere = (publicSlug: string) => ({
  publicSlug,
  publishedAt: { not: null },
});

const savedDinnerSelect = { id: true, name: true, sourceDinnerId: true };

export const findSavedPublishedDinner = async (
  db: PrismaClient,
  householdId: string,
  publicSlug: string,
) => {
  const source = await db.dinner.findUnique({
    where: activePublishedDinnerWhere(publicSlug),
    select: { id: true },
  });
  if (!source) return null;

  const match = await db.dinner.findFirst({
    where: matchingSavedDinnerWhere(householdId, source.id),
    select: savedDinnerSelect,
  });
  return match && matchesPublishedDinnerSource(match, source.id) ? match : null;
};

const savePublishedDinnerInTransaction = async (
  tx: Prisma.TransactionClient,
  householdId: string,
  publicSlug: string,
  options: { forceCopy?: boolean; now?: Date } = {},
) => {
  const initialSource = await tx.dinner.findUnique({
    where: activePublishedDinnerWhere(publicSlug),
    select: { id: true },
  });
  if (!initialSource) return null;

  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`published-dinner-save:${householdId}`}))`;

  // Hold a read lock so stopping publication or deleting the source cannot
  // complete between the latest-content read and creation of the copy.
  const activeSource = await tx.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM "Dinner"
      WHERE id = ${initialSource.id} AND "publishedAt" IS NOT NULL
      FOR SHARE
    `;
  if (activeSource.length === 0) return null;

  const source = await tx.dinner.findUnique({
    where: { id: initialSource.id },
    include: publishedDinnerCopyInclude,
  });
  if (!source?.publishedAt) return null;

  if (!options.forceCopy) {
    const existing = await tx.dinner.findFirst({
      where: matchingSavedDinnerWhere(householdId, source.id),
      select: savedDinnerSelect,
    });
    if (existing && matchesPublishedDinnerSource(existing, source.id)) {
      return { dinner: existing, createdNewCopy: false };
    }
  }

  const now = options.now ?? new Date();
  const recentSaveCount = await tx.dinner.count({
    where: {
      householdId,
      sourceDinnerId: { not: null },
      createdAt: {
        gte: new Date(now.getTime() - SAVE_BURST_WINDOW_MS),
      },
    },
  });
  if (recentSaveCount >= SAVE_BURST_LIMIT) {
    throw new PublishedDinnerSaveRateLimitError(
      "Too many Dinners were saved at once. Try again shortly.",
    );
  }

  const destinationTags = await tx.tag.findMany({
    where: { Dinner: { some: { householdId } } },
    select: { value: true },
    orderBy: { value: "asc" },
  });
  const dinner = await tx.dinner.create({
    data: projectPublishedDinnerCopy(
      source,
      householdId,
      destinationTags.map((tag) => tag.value),
    ),
    select: savedDinnerSelect,
  });

  return { dinner, createdNewCopy: true };
};

export const savePublishedDinner = async (
  db: PrismaClient,
  householdId: string,
  publicSlug: string,
  options: { forceCopy?: boolean; now?: Date } = {},
) =>
  db.$transaction((tx) =>
    savePublishedDinnerInTransaction(tx, householdId, publicSlug, options),
  );

export type PublishedDinnerSaveUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
};

export const savePublishedDinnerForUser = async (
  db: PrismaClient,
  user: PublishedDinnerSaveUser,
  publicSlug: string,
  options: { forceCopy?: boolean; now?: Date } = {},
) => {
  try {
    return await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`published-dinner-save-user:${user.id}`}))`;

      await tx.user.upsert({
        where: { id: user.id },
        update: {
          firstName: user.firstName,
          lastName: user.lastName,
          imageUrl: user.imageUrl,
        },
        create: user,
      });

      const existingMembership = await tx.membership.findUnique({
        where: { userId: user.id },
        select: { householdId: true },
      });
      const householdId = existingMembership
        ? existingMembership.householdId
        : (
            await tx.household.create({
              data: {
                name: publishedDinnerSaveHouseholdName(user),
                slug: publishedDinnerSaveHouseholdSlug(
                  publishedDinnerSaveHouseholdName(user),
                ),
                Members: {
                  create: { userId: user.id, role: "ADMIN" },
                },
              },
              select: { id: true },
            })
          ).id;

      const result = await savePublishedDinnerInTransaction(
        tx,
        householdId,
        publicSlug,
        options,
      );
      if (!result) throw new PublishedDinnerUnavailableRollback();
      return { ...result, householdId };
    });
  } catch (error) {
    if (error instanceof PublishedDinnerUnavailableRollback) return null;
    throw error;
  }
};
