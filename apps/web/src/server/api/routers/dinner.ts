import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  dinnerNameSchema,
  recipeSchema,
  type DinnerWithRecipe,
  type RecipeInput,
} from "@planeatrepeat/shared";

import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedureWithHousehold,
} from "~/server/api/trpc";
import { type DinnerWithTags } from "~/utils/types";
import { acquireRecipeSource } from "~/server/ai/acquireRecipeSource";
import { extractRecipe } from "~/server/ai/extractRecipe";
import { RecipeImportError } from "~/server/ai/recipeImportError";

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
        .min(1)
        .max(4_000_000)
        .regex(/^[A-Za-z0-9+/]+={0,2}$/, "Invalid image data"),
      mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    }),
  )
  .min(1)
  .max(4)
  .refine(
    (images) =>
      images.reduce((total, image) => total + image.data.length, 0) <=
      4_000_000,
    "Images are too large. Remove a photo or retake them at a lower resolution.",
  );

const runRecipeImport = async <T>(operation: () => Promise<T>) => {
  try {
    return await operation();
  } catch (cause) {
    const importError =
      cause instanceof RecipeImportError
        ? cause
        : new RecipeImportError(
            "EXTRACTION_FAILED",
            "We could not extract a recipe from that source. Please try again.",
            { cause },
          );

    throw new TRPCError({
      code: "BAD_REQUEST",
      message: importError.message,
      cause: importError,
    });
  }
};

export const dinnerRouter = createTRPCRouter({
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

  dinners: publicProcedure.query(async ({ ctx }) => {
    const householdId = ctx.householdId;

    if (!householdId) {
      return { dinners: [] };
    }

    const dinners: DinnerWithTags[] = await ctx.db.dinner.findMany({
      where: { householdId },
      include: { tags: true },
      orderBy: { name: "asc" },
    });
    return {
      dinners: dinners,
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
    .mutation(async ({ ctx, input }) =>
      runRecipeImport(async () => {
        const [text, household] = await Promise.all([
          acquireRecipeSource(input.url),
          ctx.db.household.findUniqueOrThrow({
            where: { id: ctx.householdId },
            select: { importInstructions: true },
          }),
        ]);
        const draft = await extractRecipe({
          parts: [{ type: "text", text }],
          instructions: household.importInstructions ?? undefined,
        });
        return { ...draft, sourceUrl: input.url };
      }),
    ),

  importFromText: protectedProcedureWithHousehold
    .input(z.object({ text: z.string().trim().min(50).max(100_000) }))
    .mutation(async ({ ctx, input }) =>
      runRecipeImport(async () => {
        const household = await ctx.db.household.findUniqueOrThrow({
          where: { id: ctx.householdId },
          select: { importInstructions: true },
        });
        return extractRecipe({
          parts: [{ type: "text", text: input.text }],
          instructions: household.importInstructions ?? undefined,
        });
      }),
    ),

  importFromImages: protectedProcedureWithHousehold
    .input(z.object({ images: imageImportSchema }))
    .mutation(async ({ ctx, input }) =>
      runRecipeImport(async () => {
        const household = await ctx.db.household.findUniqueOrThrow({
          where: { id: ctx.householdId },
          select: { importInstructions: true },
        });
        return extractRecipe({
          parts: input.images.map((image) => ({
            type: "image" as const,
            image: Uint8Array.from(Buffer.from(image.data, "base64")),
            mimeType: image.mimeType,
          })),
          instructions: household.importInstructions ?? undefined,
        });
      }),
    ),

  create: protectedProcedureWithHousehold
    .input(
      z.object({
        dinnerName: dinnerNameSchema,
        tagList: z.array(z.string()),
        link: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
        recipe: recipeSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const householdId = ctx.householdId;

      const dinner = await ctx.db.dinner.create({
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
});
