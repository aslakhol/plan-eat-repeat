import { normalizeShoppingName } from "@planeatrepeat/shared";
import { z } from "zod";
import type { ShoppingItem } from "@planeatrepeat/db";
import { saveShoppingItem, setUsuallyHave } from "../../shopping-list";
import {
  editRecentShoppingItem,
  rememberShoppingItems,
} from "../../recent-shopping-items";
import { createTRPCRouter, protectedProcedureWithHousehold } from "../trpc";

const itemFields = z.object({
  name: z.string().trim().min(1, "Enter an item name"),
  amount: z.number().finite().positive().nullable(),
  unit: z.string().nullable(),
  note: z
    .string()
    .trim()
    .nullable()
    .transform((note) => (note === "" ? null : note)),
});

export const shoppingListRouter = createTRPCRouter({
  editRecent: protectedProcedureWithHousehold
    .input(
      itemFields.extend({
        id: z.string(),
        usuallyHave: z.boolean().optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        const saved = await editRecentShoppingItem(tx, ctx.householdId, input);
        if (input.usuallyHave !== undefined) {
          await setUsuallyHave(
            tx,
            ctx.householdId,
            saved.name,
            input.usuallyHave,
          );
        }
        return saved;
      }),
    ),

  removeRecent: protectedProcedureWithHousehold
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Household" WHERE id = ${ctx.householdId} FOR UPDATE`;
        return tx.recentShoppingItem.deleteMany({
          where: { id: input.id, householdId: ctx.householdId },
        });
      }),
    ),

  recent: protectedProcedureWithHousehold.query(async ({ ctx }) => {
    const [recent, active] = await Promise.all([
      ctx.db.recentShoppingItem.findMany({
        where: { householdId: ctx.householdId },
        orderBy: [{ recentlyUsedAt: "desc" }, { normalizedName: "asc" }],
        take: 25,
        include: { product: { select: { category: true } } },
      }),
      ctx.db.shoppingItem.findMany({
        where: { householdId: ctx.householdId },
        select: { normalizedName: true },
        distinct: ["normalizedName"],
      }),
    ]);
    const activeNames = new Set(active.map((item) => item.normalizedName));
    return recent.filter((item) => !activeNames.has(item.normalizedName));
  }),

  addRecent: protectedProcedureWithHousehold
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Household" WHERE id = ${ctx.householdId} FOR UPDATE`;
        const recent = await tx.recentShoppingItem.findUniqueOrThrow({
          where: { id: input.id, householdId: ctx.householdId },
        });
        const active = await tx.shoppingItem.findFirst({
          where: {
            householdId: ctx.householdId,
            normalizedName: recent.normalizedName,
          },
        });
        if (active) return active;
        const { name, amount, unit, note } = recent;
        const saved = await saveShoppingItem(tx, ctx.householdId, {
          name,
          amount,
          unit,
          note,
        });
        await tx.recentShoppingItem.update({
          where: { id: recent.id, householdId: ctx.householdId },
          data: { revision: crypto.randomUUID() },
        });
        return saved;
      }),
    ),

  list: protectedProcedureWithHousehold.query(async ({ ctx }) => {
    const items = await ctx.db.shoppingItem.findMany({
      where: { householdId: ctx.householdId },
      include: { product: { select: { category: true } } },
    });
    return items.sort(
      (a, b) =>
        a.normalizedName.localeCompare(b.normalizedName) ||
        a.id.localeCompare(b.id),
    );
  }),

  usuallyHave: protectedProcedureWithHousehold.query(({ ctx }) =>
    ctx.db.usuallyHave.findMany({
      where: { householdId: ctx.householdId },
      orderBy: { normalizedName: "asc" },
    }),
  ),

  setUsuallyHave: protectedProcedureWithHousehold
    .input(
      z.object({
        name: z.string().trim().min(1, "Enter an ingredient name"),
        excluded: z.boolean(),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((tx) =>
        setUsuallyHave(tx, ctx.householdId, input.name, input.excluded),
      ),
    ),

  addManual: protectedProcedureWithHousehold
    .input(z.object({ name: z.string().trim().min(1, "Enter an item name") }))
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((tx) =>
        saveShoppingItem(tx, ctx.householdId, {
          name: input.name,
          amount: null,
          unit: null,
          note: null,
        }),
      ),
    ),

  addDinners: protectedProcedureWithHousehold
    .input(z.object({ dinnerIds: z.array(z.number().int().positive()).min(1) }))
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Household" WHERE id = ${ctx.householdId} FOR UPDATE`;
        const before = new Map(
          (
            await tx.shoppingItem.findMany({
              where: { householdId: ctx.householdId },
            })
          ).map((item) => [item.id, item]),
        );
        const excludedNames = new Set(
          (
            await tx.usuallyHave.findMany({
              where: { householdId: ctx.householdId },
            })
          ).map(({ normalizedName }) => normalizedName),
        );
        const recentBefore = new Map(
          (
            await tx.recentShoppingItem.findMany({
              where: {
                householdId: ctx.householdId,
                normalizedName: { in: [...excludedNames] },
              },
            })
          ).map((item) => [item.normalizedName, item]),
        );
        const added = new Map<string, ShoppingItem>();
        const skipped: Pick<
          ShoppingItem,
          "name" | "amount" | "unit" | "note"
        >[] = [];
        for (const dinnerId of input.dinnerIds) {
          const dinner = await tx.dinner.findUniqueOrThrow({
            where: { id: dinnerId, householdId: ctx.householdId },
            include: {
              parts: {
                orderBy: { order: "asc" },
                include: { ingredients: { orderBy: { order: "asc" } } },
              },
            },
          });
          const ingredients = dinner.parts.flatMap((part) => part.ingredients);
          const requirements =
            ingredients.length > 0
              ? ingredients
              : [{ name: dinner.name, amount: null, unit: null }];
          for (const item of requirements) {
            if (excludedNames.has(normalizeShoppingName(item.name))) {
              skipped.push({
                name: item.name,
                amount: item.amount,
                unit: item.unit,
                note: null,
              });
              continue;
            }
            const saved = await saveShoppingItem(tx, ctx.householdId, {
              name: item.name,
              amount: item.amount,
              unit: item.unit,
              note: null,
            });
            added.set(saved.id, saved);
          }
        }
        const recent = await rememberShoppingItems(
          tx,
          ctx.householdId,
          skipped,
        );
        return {
          undo: {
            recent: recent.map(({ id, normalizedName, revision }) => {
              const original = recentBefore.get(normalizedName);
              return {
                id,
                revision,
                before: original
                  ? {
                      name: original.name,
                      amount: original.amount,
                      unit: original.unit,
                      note: original.note,
                      recentlyUsedAt: original.recentlyUsedAt,
                      revision: original.revision,
                    }
                  : null,
              };
            }),
            items: [...added.values()].flatMap(
              ({ id, name, amount, unit, note }) => {
                const original = before.get(id);
                if (original?.amount === amount && original.note === note)
                  return [];
                return [
                  {
                    id,
                    name,
                    amount,
                    unit,
                    note,
                    before: original
                      ? { amount: original.amount, note: original.note }
                      : null,
                  },
                ];
              },
            ),
          },
        };
      }),
    ),

  undo: protectedProcedureWithHousehold
    .input(
      z.object({
        recent: z
          .array(
            z.object({
              id: z.string(),
              revision: z.string(),
              before: itemFields
                .extend({ recentlyUsedAt: z.date(), revision: z.string() })
                .nullable(),
            }),
          )
          .default([]),
        items: z.array(
          itemFields.extend({
            id: z.string(),
            before: itemFields.pick({ amount: true, note: true }).nullable(),
          }),
        ),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Household" WHERE id = ${ctx.householdId} FOR UPDATE`;
        for (const { before, ...after } of input.items) {
          // Leave requirements edited or removed since this addition alone.
          const where = { ...after, householdId: ctx.householdId };
          if (before) {
            await tx.shoppingItem.updateMany({ where, data: before });
          } else {
            await tx.shoppingItem.deleteMany({ where });
          }
        }
        for (const { before, ...after } of input.recent) {
          // Revisions also protect edits that only change recency or restore an item.
          const where = { ...after, householdId: ctx.householdId };
          if (before) {
            await tx.recentShoppingItem.updateMany({
              where,
              data: {
                ...before,
                normalizedName: normalizeShoppingName(before.name),
              },
            });
          } else {
            await tx.recentShoppingItem.deleteMany({ where });
          }
        }
      }),
    ),

  edit: protectedProcedureWithHousehold
    .input(
      itemFields.extend({
        id: z.string(),
        usuallyHave: z.boolean().optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        const { usuallyHave, ...fields } = input;
        const saved = await saveShoppingItem(tx, ctx.householdId, fields);
        if (usuallyHave !== undefined) {
          await setUsuallyHave(tx, ctx.householdId, saved.name, usuallyHave);
        }
        return saved;
      }),
    ),

  remove: protectedProcedureWithHousehold
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Household" WHERE id = ${ctx.householdId} FOR UPDATE`;
        const where = { id: input.id, householdId: ctx.householdId };
        const item = await tx.shoppingItem.findUnique({ where });
        if (item) await rememberShoppingItems(tx, ctx.householdId, [item]);
        return tx.shoppingItem.deleteMany({ where });
      }),
    ),

  clear: protectedProcedureWithHousehold.mutation(({ ctx }) =>
    ctx.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Household" WHERE id = ${ctx.householdId} FOR UPDATE`;
      const where = { householdId: ctx.householdId };
      const items = await tx.shoppingItem.findMany({
        where,
        orderBy: [{ normalizedName: "asc" }, { id: "asc" }],
      });
      await rememberShoppingItems(tx, ctx.householdId, items);
      return tx.shoppingItem.deleteMany({ where });
    }),
  ),
});
