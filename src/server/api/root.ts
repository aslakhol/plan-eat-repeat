import { createTRPCRouter } from "~/server/api/trpc";
import { dinnerRouter } from "./routers/dinner";
import { planRouter } from "./routers/plan";
import { householdRouter } from "./routers/household";
/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  dinner: dinnerRouter,
  plan: planRouter,
  household: householdRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
