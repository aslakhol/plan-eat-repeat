import {
  currentTransfer,
  recover,
  resolveUncertain,
  send,
} from "../../oda/transfer";
import { z } from "zod";
import { createTRPCRouter, protectedProcedureWithHousehold } from "../trpc";
import {
  callback,
  connect,
  connectionStatus,
  disconnect,
} from "../../oda/connection";
import { odaTool, productSearchSchema } from "../../oda/provider";

export const odaRouter = createTRPCRouter({
  searchProducts: protectedProcedureWithHousehold
    .input(z.object({ query: z.string().trim().min(2).max(200) }))
    .query(async ({ ctx, input }) => {
      const response = productSearchSchema.parse(
        await odaTool(ctx.db, ctx.householdId, "product_search", {
          queries: [input.query],
          size: 20,
        }),
      );
      return [
        ...new Map(
          response.result
            .flatMap(({ products }) => products)
            .map((product) => [product.id, product]),
        ).values(),
      ];
    }),
  dismiss: protectedProcedureWithHousehold
    .input(z.object({ id: z.string().uuid() }))
    .mutation(({ ctx, input }) =>
      ctx.db.odaTransfer.updateMany({
        where: {
          id: input.id,
          householdId: ctx.householdId,
          state: "COMPLETED",
        },
        data: { dismissed: true },
      }),
    ),
  resolve: protectedProcedureWithHousehold
    .input(
      z.object({
        id: z.string().uuid(),
        outcome: z.enum(["ADDED", "NOT_ADDED"]),
      }),
    )
    .mutation(({ ctx, input }) =>
      resolveUncertain(
        ctx.db,
        ctx.householdId,
        ctx.auth.userId,
        input.id,
        input.outcome,
      ),
    ),
  recover: protectedProcedureWithHousehold
    .input(z.object({ id: z.string().uuid() }))
    .mutation(({ ctx, input }) => recover(ctx.db, ctx.householdId, input.id)),
  transfer: protectedProcedureWithHousehold.query(({ ctx }) =>
    currentTransfer(ctx.db, ctx.householdId),
  ),
  send: protectedProcedureWithHousehold
    .input(z.object({ id: z.string().uuid() }))
    .mutation(({ ctx, input }) => send(ctx.db, ctx.householdId, input.id)),
  status: protectedProcedureWithHousehold.query(({ ctx }) =>
    connectionStatus(ctx.db, ctx.householdId),
  ),
  connect: protectedProcedureWithHousehold.mutation(({ ctx }) =>
    connect(ctx.db, ctx.householdId, ctx.auth.userId),
  ),
  callback: protectedProcedureWithHousehold
    .input(z.object({ state: z.string().min(1), code: z.string().min(1) }))
    .mutation(({ ctx, input }) =>
      callback(ctx.db, ctx.householdId, ctx.auth.userId, input),
    ),
  disconnect: protectedProcedureWithHousehold.mutation(({ ctx }) =>
    disconnect(ctx.db, ctx.householdId),
  ),
});
