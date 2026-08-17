import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  ImportRecipeError,
  dinnerNameSchema,
  importErrorMessages,
  MAX_RECIPE_IMPORT_IMAGE_DATA_LENGTH,
  MAX_RECIPE_IMPORT_IMAGES,
  recipeSchema,
  youtubeVideoIdFromUrl,
  type DinnerWithRecipe,
  type RecipeInput,
} from "@planeatrepeat/shared";

import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedureWithHousehold,
  sessionProcedure,
} from "~/server/api/trpc";
import {
  importRecipeFromImages,
  importRecipeFromText,
  importRecipeFromUrl,
} from "~/server/recipes/importRecipe";
import { acquireYouTubeVideoTitle } from "~/server/recipes/youtube";
import { planDinnerMerge } from "~/server/merge-dinners";
import { type PrismaClient } from "@planeatrepeat/db";
import {
  PublicationRateLimitError,
  publishDinner,
  stopDinnerPublication,
} from "~/server/published-dinner";
import { publishedDinnerUrl } from "~/lib/published-dinner";
import { env } from "~/env";
import {
  findSavedPublishedDinner,
  PublishedDinnerSaveRateLimitError,
  savePublishedDinner,
  savePublishedDinnerForUser,
} from "~/server/save-published-dinner";
import { clerkClient } from "@clerk/nextjs/server";
import { updateClerkHouseholdMetadata } from "~/server/clerk-household-metadata";

const householdImportInstructions = async (
  db: PrismaClient,
  householdId: string,
) => {
  const household = await db.household.findUniqueOrThrow({
    where: { id: householdId },
    select: { importInstructions: true },
  });
  return household.importInstructions;
};

const householdDinnersWithTags = (db: PrismaClient, householdId: string) =>
  db.dinner.findMany({
    where: { householdId },
    include: { tags: true },
    orderBy: [{ name: "asc" as const }, { id: "asc" as const }],
  });

const createRecipeParts = (parts: RecipeInput["parts"]) =>
  parts.map((part, partIndex) => ({
    name: part.name,
    order: partIndex,
    ingredients: {
      create: part.ingredients.map((ingredient, ingredientIndex) => ({
        ...ingredient,
        order: ingredientIndex,
      })),
    },
    steps: {
      create: part.steps.map((text, stepIndex) => ({
        text,
        order: stepIndex,
      })),
    },
  }));

const recipeServings = (recipe: RecipeInput) =>
  recipe.parts.length === 0 ? null : recipe.servings;

const imageImportSchema = z
  .array(
    z.object({
      data: z
        .string()
        .min(4)
        .max(MAX_RECIPE_IMPORT_IMAGE_DATA_LENGTH)
        .regex(
          /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/,
          "Invalid image data",
        ),
      mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    }),
  )
  .min(1)
  .max(MAX_RECIPE_IMPORT_IMAGES)
  .refine(
    (images) =>
      images.reduce((total, image) => total + image.data.length, 0) <=
      MAX_RECIPE_IMPORT_IMAGE_DATA_LENGTH,
    "Images are too large. Remove a photo or retake them at a lower resolution.",
  );

// The machine code rides error.data.importErrorCode (lifted from `cause` by
// the errorFormatter in trpc.ts); message stays human-readable.
const toImportTRPCError = (error: unknown) => {
  if (error instanceof ImportRecipeError) {
    return new TRPCError({
      code: "BAD_REQUEST",
      message: importErrorMessages[error.code],
      cause: error,
    });
  }

  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: importErrorMessages.EXTRACTION_FAILED,
    cause: error,
  });
};

export const dinnerRouter = createTRPCRouter({
  publishedSaveStatus: sessionProcedure
    .input(z.object({ publicSlug: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const membership = await ctx.db.membership.findUnique({
        where: { userId: ctx.auth.userId },
        select: { householdId: true },
      });
      return {
        dinner: membership
          ? await findSavedPublishedDinner(
              ctx.db,
              membership.householdId,
              input.publicSlug,
            )
          : null,
      };
    }),

  savePublished: sessionProcedure
    .input(
      z.object({
        publicSlug: z.string().min(1),
        forceCopy: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const membership = await ctx.db.membership.findUnique({
          where: { userId: ctx.auth.userId },
          select: { householdId: true },
        });
        let householdId = membership?.householdId;
        let result: Awaited<ReturnType<typeof savePublishedDinner>>;
        if (householdId) {
          result = await savePublishedDinner(
            ctx.db,
            householdId,
            input.publicSlug,
            { forceCopy: input.forceCopy },
          );
        } else {
          const clerkUser = await (
            await clerkClient()
          ).users.getUser(ctx.auth.userId);
          const bootstrapResult = await savePublishedDinnerForUser(
            ctx.db,
            {
              id: clerkUser.id,
              firstName: clerkUser.firstName,
              lastName: clerkUser.lastName,
              imageUrl: clerkUser.imageUrl,
            },
            input.publicSlug,
            { forceCopy: input.forceCopy },
          );
          householdId = bootstrapResult?.householdId;
          result = bootstrapResult;
        }
        if (!result || !householdId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "This Dinner is no longer shared",
          });
        }
        if (ctx.auth.sessionClaims?.metadata.householdId !== householdId) {
          await updateClerkHouseholdMetadata(ctx.auth.userId, householdId);
        }
        return {
          dinner: result.dinner,
          createdNewCopy: result.createdNewCopy,
        };
      } catch (error) {
        if (error instanceof PublishedDinnerSaveRateLimitError) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: error.message,
          });
        }
        throw error;
      }
    }),

  publish: protectedProcedureWithHousehold
    .input(z.object({ dinnerId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const dinner = await publishDinner(
          ctx.db,
          ctx.householdId,
          input.dinnerId,
        );
        if (!dinner?.publicSlug || !dinner.publishedAt) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Dinner not found",
          });
        }

        return {
          publicSlug: dinner.publicSlug,
          publishedAt: dinner.publishedAt,
          publicUrl: publishedDinnerUrl(
            dinner.publicSlug,
            env.NEXT_PUBLIC_APP_URL,
          ),
        };
      } catch (error) {
        if (error instanceof PublicationRateLimitError) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: error.message,
          });
        }
        throw error;
      }
    }),

  stopPublication: protectedProcedureWithHousehold
    .input(z.object({ dinnerId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const stopped = await stopDinnerPublication(
        ctx.db,
        ctx.householdId,
        input.dinnerId,
      );
      if (!stopped) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Dinner not found",
        });
      }

      return { stopped: true };
    }),

  tags: publicProcedure.query(async ({ ctx }) => {
    const tags = await ctx.db.tag.findMany({
      orderBy: { value: "asc" },
      include: {
        _count: {
          select: { Dinner: { where: { householdId: ctx.householdId } } },
        },
      },
    });
    return {
      tags: tags.filter((tag) => tag._count.Dinner > 0),
    };
  }),

  // Retained for the mobile client while the redesigned web Cookbook consumes
  // the richer summaries endpoint.
  dinners: publicProcedure.query(async ({ ctx }) => {
    const householdId = ctx.householdId;

    if (!householdId) {
      return { dinners: [] };
    }

    const dinners = await householdDinnersWithTags(ctx.db, householdId);

    return { dinners };
  }),

  summaries: publicProcedure
    .input(
      z
        .object({
          today: z.date(),
          currentWeekStart: z.date(),
          currentWeekEnd: z.date(),
        })
        .refine(
          ({ currentWeekStart, currentWeekEnd }) =>
            currentWeekStart < currentWeekEnd,
          "Current week end must be after its start",
        ),
    )
    .query(async ({ ctx, input }) => {
      const householdId = ctx.householdId;

      if (!householdId) {
        return { dinners: [] };
      }

      const dinners = await householdDinnersWithTags(ctx.db, householdId);
      const dinnerIds = dinners.map((dinner) => dinner.id);

      if (dinnerIds.length === 0) {
        return { dinners: [] };
      }

      const [pastPlanSummaries, currentWeekPlans] = await Promise.all([
        ctx.db.plan.groupBy({
          by: ["dinnerId"],
          where: {
            dinnerId: { in: dinnerIds },
            date: { lt: input.today },
          },
          _count: { _all: true },
          _max: { date: true },
        }),
        ctx.db.plan.findMany({
          where: {
            dinnerId: { in: dinnerIds },
            date: {
              gte: input.currentWeekStart,
              lt: input.currentWeekEnd,
            },
          },
          select: { dinnerId: true, date: true },
          orderBy: [{ date: "asc" }, { id: "asc" }],
        }),
      ]);

      const pastPlansByDinner = new Map(
        pastPlanSummaries.map((summary) => [summary.dinnerId, summary]),
      );
      const currentWeekPlansByDinner = new Map<number, Date[]>();
      for (const plan of currentWeekPlans) {
        const dates = currentWeekPlansByDinner.get(plan.dinnerId) ?? [];
        dates.push(plan.date);
        currentWeekPlansByDinner.set(plan.dinnerId, dates);
      }

      return {
        dinners: dinners.map((dinner) => {
          const history = pastPlansByDinner.get(dinner.id);
          return {
            ...dinner,
            lastCookedDate: history?._max.date ?? null,
            cookingFrequency: history?._count._all ?? 0,
            currentWeekPlanDates: currentWeekPlansByDinner.get(dinner.id) ?? [],
          };
        }),
      };
    }),

  get: publicProcedure
    .input(z.object({ dinnerId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.householdId) {
        return { dinner: null };
      }

      const dinner: DinnerWithRecipe | null = await ctx.db.dinner.findUnique({
        where: {
          id: input.dinnerId,
          householdId: ctx.householdId,
        },
        include: {
          tags: true,
          parts: {
            orderBy: { order: "asc" },
            include: {
              ingredients: { orderBy: { order: "asc" } },
              steps: { orderBy: { order: "asc" } },
            },
          },
        },
      });

      return { dinner };
    }),

  ingredientNames: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.householdId) {
      return { ingredientNames: [] };
    }

    const ingredients = await ctx.db.recipeIngredient.findMany({
      where: {
        part: {
          dinner: {
            householdId: ctx.householdId,
          },
        },
      },
      distinct: ["name"],
      select: { name: true },
      orderBy: { name: "asc" },
    });

    return {
      ingredientNames: ingredients.map((ingredient) => ingredient.name),
    };
  }),

  importFromUrl: protectedProcedureWithHousehold
    .input(z.object({ url: z.string().url() }))
    .mutation(async ({ ctx, input, signal }) => {
      try {
        const instructions = await householdImportInstructions(
          ctx.db,
          ctx.householdId,
        );
        const draft = await importRecipeFromUrl(
          input.url,
          instructions,
          signal,
        );
        return {
          ...draft,
          sourceUrl: input.url,
        };
      } catch (error) {
        throw toImportTRPCError(error);
      }
    }),

  youtubeVideoTitle: protectedProcedureWithHousehold
    .input(z.object({ url: z.string().url() }))
    .query(async ({ input, signal }) => {
      const videoId = youtubeVideoIdFromUrl(input.url);
      if (!videoId) return { title: null };
      return { title: await acquireYouTubeVideoTitle(videoId, signal) };
    }),

  importFromText: protectedProcedureWithHousehold
    .input(z.object({ text: z.string().trim().min(1) }))
    .mutation(async ({ ctx, input, signal }) => {
      try {
        const instructions = await householdImportInstructions(
          ctx.db,
          ctx.householdId,
        );
        return await importRecipeFromText(input.text, instructions, signal);
      } catch (error) {
        throw toImportTRPCError(error);
      }
    }),

  importFromImages: protectedProcedureWithHousehold
    .input(z.object({ images: imageImportSchema }))
    .mutation(async ({ ctx, input, signal }) => {
      try {
        const instructions = await householdImportInstructions(
          ctx.db,
          ctx.householdId,
        );
        return await importRecipeFromImages(input.images, instructions, signal);
      } catch (error) {
        throw toImportTRPCError(error);
      }
    }),

  create: protectedProcedureWithHousehold
    .input(
      z.object({
        dinnerName: dinnerNameSchema,
        tagList: z.array(z.string()),
        link: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
        recipe: recipeSchema.optional(),
        planDate: z.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const householdId = ctx.householdId;

      const dinner = await ctx.db.$transaction(async (tx) => {
        const createdDinner = await tx.dinner.create({
          data: {
            name: input.dinnerName,
            link: input.link,
            notes: input.notes,
            householdId,
            servings:
              input.recipe === undefined
                ? undefined
                : recipeServings(input.recipe),
            tags: {
              connectOrCreate: input.tagList.map((tag) => {
                return {
                  where: { value: tag },
                  create: { value: tag },
                };
              }),
            },
            parts:
              input.recipe === undefined
                ? undefined
                : { create: createRecipeParts(input.recipe.parts) },
          },
        });

        if (input.planDate) {
          const existingPlan = await tx.plan.findFirst({
            where: {
              date: input.planDate,
              dinner: { householdId },
            },
          });

          if (existingPlan) {
            await tx.plan.update({
              where: { id: existingPlan.id },
              data: { dinnerId: createdDinner.id },
            });
          } else {
            await tx.plan.create({
              data: { date: input.planDate, dinnerId: createdDinner.id },
            });
          }
        }

        return createdDinner;
      });

      return {
        dinner,
      };
    }),
  edit: protectedProcedureWithHousehold
    .input(
      z.object({
        dinnerName: dinnerNameSchema,
        dinnerId: z.number(),
        tagList: z.array(z.string()),
        link: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
        recipe: recipeSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const dinner = await ctx.db.$transaction(async (tx) => {
        const previousDinner = await tx.dinner.findUniqueOrThrow({
          where: {
            id: input.dinnerId,
            householdId: ctx.householdId,
          },
          include: { tags: true },
        });

        const tagsToRemove = previousDinner.tags.filter(
          (tag) => !input.tagList.includes(tag.value),
        );

        return tx.dinner.update({
          where: {
            id: input.dinnerId,
            householdId: ctx.householdId,
          },
          data: {
            name: input.dinnerName,
            link: input.link,
            notes: input.notes,
            servings:
              input.recipe === undefined
                ? undefined
                : recipeServings(input.recipe),
            tags: {
              connectOrCreate: input.tagList.map((tag) => {
                return {
                  where: { value: tag },
                  create: { value: tag },
                };
              }),
              disconnect: tagsToRemove,
            },
            parts:
              input.recipe === undefined
                ? undefined
                : {
                    deleteMany: {},
                    create: createRecipeParts(input.recipe.parts),
                  },
          },
        });
      });

      return {
        dinner,
      };
    }),
  delete: protectedProcedureWithHousehold
    .input(z.object({ dinnerId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const dinner = await ctx.db.dinner.delete({
        where: { id: input.dinnerId, householdId: ctx.householdId },
      });

      return {
        dinner,
      };
    }),
  merge: protectedProcedureWithHousehold
    .input(
      z.object({
        keptDinnerId: z.number().int(),
        discardedDinnerId: z.number().int(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.keptDinnerId === input.discardedDinnerId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Choose two different Dinners",
        });
      }

      const keptDinner = await ctx.db.$transaction(async (tx) => {
        const dinners = await tx.dinner.findMany({
          where: {
            id: { in: [input.keptDinnerId, input.discardedDinnerId] },
            householdId: ctx.householdId,
          },
          select: { id: true, name: true },
        });
        if (dinners.length !== 2) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Dinner not found",
          });
        }

        const kept = dinners.find((dinner) => dinner.id === input.keptDinnerId);
        if (!kept) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Dinner not found",
          });
        }

        const planSlots = await tx.plan.findMany({
          where: {
            dinnerId: {
              in: [input.keptDinnerId, input.discardedDinnerId],
            },
          },
          select: { id: true, dinnerId: true, date: true },
        });
        const changes = planDinnerMerge({
          keptDinnerId: input.keptDinnerId,
          discardedDinnerId: input.discardedDinnerId,
          planSlots,
        });

        if (changes.reassignPlanSlotIds.length > 0) {
          await tx.plan.updateMany({
            where: { id: { in: changes.reassignPlanSlotIds } },
            data: { dinnerId: input.keptDinnerId },
          });
        }
        if (changes.deletePlanSlotIds.length > 0) {
          await tx.plan.deleteMany({
            where: { id: { in: changes.deletePlanSlotIds } },
          });
        }

        await tx.dinner.delete({
          where: {
            id: input.discardedDinnerId,
            householdId: ctx.householdId,
          },
        });

        return kept;
      });

      return { keptDinner };
    }),
  setFavourite: protectedProcedureWithHousehold
    .input(z.object({ dinnerId: z.number(), favourite: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const dinner = await ctx.db.dinner.update({
        where: { id: input.dinnerId, householdId: ctx.householdId },
        data: { favourite: input.favourite },
        select: { id: true, favourite: true },
      });

      return { dinner };
    }),
});
