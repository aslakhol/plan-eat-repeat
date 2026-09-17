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
import { cartSchema, odaTool } from "../../oda/provider";

export const odaRouter = createTRPCRouter({
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
  cart: protectedProcedureWithHousehold.query(async ({ ctx }) => ({
    url: cartSchema.parse(await odaTool(ctx.db, ctx.householdId, "get_cart"))
      .url,
  })),
});
