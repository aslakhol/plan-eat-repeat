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
  cart: protectedProcedureWithHousehold.query(async ({ ctx }) =>
    cartSchema.parse(await odaTool(ctx.db, ctx.householdId, "get_cart")),
  ),
});
