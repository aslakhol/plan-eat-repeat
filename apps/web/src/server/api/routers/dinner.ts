import { z } from "zod";
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
