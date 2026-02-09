/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */

import { getAuth } from "@clerk/nextjs/server";
import { initTRPC, TRPCError } from "@trpc/server";
import { type CreateNextContextOptions } from "@trpc/server/adapters/next";
import superjson from "superjson";
import { ZodError } from "zod";

import { db } from "~/server/db";

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 */

type CreateContextOptions = {
  auth: Awaited<ReturnType<typeof getAuth>>;
  parityBypass: {
    userId: string;
    householdId: string;
  } | null;
};

/**
 * This helper generates the "internals" for a tRPC context. If you need to use it, you can export
 * it from here.
 *
 * Examples of things you may need it for:
 * - testing, so we don't have to mock Next.js' req/res
 * - tRPC's `createSSGHelpers`, where we don't have req/res
 *
 * @see https://create.t3.gg/en/usage/trpc#-serverapitrpcts
 */
const createInnerTRPCContext = (_opts: CreateContextOptions) => {
  return {
    db,
    auth: _opts.auth,
    parityBypass: _opts.parityBypass,
  };
};

/**
 * This is the actual context you will use in your router. It will be used to process every request
 * that goes through your tRPC endpoint.
 *
 * @see https://trpc.io/docs/context
 */
export const createTRPCContext = async (_opts: CreateNextContextOptions) => {
  return createInnerTRPCContext({
    auth: getAuthSafe(_opts.req),
    parityBypass: await resolveParityBypass(),
  });
};

type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

async function resolveParityBypass(): Promise<CreateContextOptions["parityBypass"]> {
  if (process.env.NODE_ENV === "production") {
    return null;
  }
  if (process.env.PARITY_BYPASS_AUTH !== "true") {
    return null;
  }

  const configuredUserId = process.env.PARITY_BYPASS_USER_ID;
  const configuredHouseholdId = process.env.PARITY_BYPASS_HOUSEHOLD_ID;

  if (configuredUserId && configuredHouseholdId) {
    return {
      userId: configuredUserId,
      householdId: configuredHouseholdId,
    };
  }

  const firstMembership = await db.membership.findFirst({
    select: {
      userId: true,
      householdId: true,
    },
    orderBy: {
      id: "asc",
    },
  });

  if (firstMembership) {
    return {
      userId: configuredUserId ?? firstMembership.userId,
      householdId: configuredHouseholdId ?? firstMembership.householdId,
    };
  }

  const firstHousehold = await db.household.findFirst({
    select: {
      id: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (!firstHousehold) {
    return null;
  }

  return {
    userId: configuredUserId ?? "parity-bypass-user",
    householdId: configuredHouseholdId ?? firstHousehold.id,
  };
}

function getAuthSafe(req: CreateNextContextOptions["req"]) {
  try {
    return getAuth(req);
  } catch (error) {
    if (process.env.PARITY_BYPASS_AUTH !== "true") {
      throw error;
    }
    // Clerk can throw in non-browser/dev scenarios; parity mode should still work.
    return {
      userId: null,
      sessionClaims: null,
    } as Awaited<ReturnType<typeof getAuth>>;
  }
}

function getEffectiveUserId(ctx: TRPCContext) {
  return ctx.parityBypass?.userId ?? ctx.auth.userId;
}

function getEffectiveHouseholdId(ctx: TRPCContext) {
  return (
    ctx.parityBypass?.householdId ?? ctx.auth.sessionClaims?.metadata.householdId
  );
}

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});
const hasHouseholdOrUndefined = t.middleware(({ next, ctx }) => {
  const householdId = getEffectiveHouseholdId(ctx);

  return next({
    ctx: {
      householdId,
    },
  });
});
const isAuthed = t.middleware(({ next, ctx }) => {
  const householdId = getEffectiveHouseholdId(ctx);
  const userId = getEffectiveUserId(ctx);

  if (!userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      auth: {
        ...ctx.auth,
        userId,
      },
      parityBypass: ctx.parityBypass,
      householdId,
    },
  });
});

const isAuthedAndHasHousehold = t.middleware(({ next, ctx }) => {
  const userId = getEffectiveUserId(ctx);
  const householdId = getEffectiveHouseholdId(ctx);

  if (!userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  if (!householdId) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next({
    ctx: {
      auth: {
        ...ctx.auth,
        userId,
      },
      parityBypass: ctx.parityBypass,
      householdId,
    },
  });
});

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */
export const publicProcedure = t.procedure.use(hasHouseholdOrUndefined);
export const protectedProcedure = t.procedure.use(isAuthed);
export const protectedProcedureWithHousehold = t.procedure.use(
  isAuthedAndHasHousehold,
);
