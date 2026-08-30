import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";

import { createPrismaClient, type PrismaClient } from "@planeatrepeat/db";
import type { LanguageModelUsage } from "ai";

const { loadEnvConfig } = createRequire(import.meta.url)(
  "@next/env",
) as typeof import("@next/env");
loadEnvConfig(process.cwd());

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for integration tests");
}

const usage: LanguageModelUsage = {
  inputTokens: 1_000,
  inputTokenDetails: {
    noCacheTokens: 1_000,
    cacheReadTokens: undefined,
    cacheWriteTokens: undefined,
  },
  outputTokens: 200,
  outputTokenDetails: {
    textTokens: 200,
    reasoningTokens: undefined,
  },
  totalTokens: 1_200,
};

mock.module("@clerk/nextjs/server", {
  namedExports: {
    clerkClient: () =>
      Promise.reject(
        new Error("The test user should already exist in the database"),
      ),
    getAuth: () => ({ userId: null }),
  },
});

mock.module(new URL("./ai/extractRecipe.ts", import.meta.url).href, {
  namedExports: {
    extractRecipe: async (input: {
      observer?: {
        onInferenceStart(): Promise<void> | void;
        onInferenceUsage(
          model: string,
          usage: LanguageModelUsage,
        ): Promise<void> | void;
      };
    }) => {
      await input.observer?.onInferenceStart();
      await input.observer?.onInferenceUsage("claude-opus-4-8", usage);
      return {
        name: "Tomato soup",
        recipe: { servings: null, parts: [] },
      };
    },
  },
});

const { dinnerRouter } = await import("./api/routers/dinner");
type DinnerCaller = ReturnType<typeof dinnerRouter.createCaller>;

const withFixture = async (
  run: (fixture: {
    caller: DinnerCaller;
    db: PrismaClient;
    householdId: string;
    userId: string;
  }) => Promise<void>,
) => {
  const db = createPrismaClient(databaseUrl);
  const marker = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const userId = `text-import-tracking-${marker}`;
  await db.user.create({ data: { id: userId } });
  const household = await db.household.create({
    data: {
      name: `Text Import Tracking ${marker}`,
      slug: `text-import-tracking-${marker}`,
      importInstructions: "Use Norwegian",
      Members: { create: { userId, role: "ADMIN" } },
    },
  });
  const caller = dinnerRouter.createCaller({
    db,
    auth: { userId },
  } as Parameters<typeof dinnerRouter.createCaller>[0]);

  try {
    await run({ caller, db, householdId: household.id, userId });
  } finally {
    await db.aiImportAttempt.deleteMany({
      where: { householdAttributionKey: household.aiImportSpendAttributionKey },
    });
    await db.household.deleteMany({ where: { id: household.id } });
    await db.user.deleteMany({ where: { id: userId } });
    await db.$disconnect();
  }
};

void test("an accepted Text mutation records exactly one priced attempt", () =>
  withFixture(async ({ caller, db, householdId, userId }) => {
    const result = await caller.importFromText({
      text: "A tomato soup recipe",
    });
    assert.equal(result.name, "Tomato soup");

    const membership = await db.membership.findUniqueOrThrow({
      where: { userId },
      include: { household: true },
    });
    const attempts = await db.aiImportAttempt.findMany({
      where: { householdId },
    });
    assert.equal(attempts.length, 1);
    assert.deepEqual(attempts[0], {
      id: attempts[0]?.id,
      source: "TEXT",
      startedAt: attempts[0]?.startedAt,
      finishedAt: attempts[0]?.finishedAt,
      householdId,
      membershipId: membership.id,
      householdAttributionKey: membership.household.aiImportSpendAttributionKey,
      membershipAttributionKey: membership.aiImportSpendAttributionKey,
      inferenceState: "ESTIMATED",
      inferenceStartedAt: attempts[0]?.inferenceStartedAt,
      estimatedAiImportCostUsd: 0.01,
      supadataOperationsStarted: 0,
      supadataCredits: 0,
      supadataUnknownOperationCount: 0,
    });
    assert.ok(attempts[0]?.finishedAt);
    assert.ok(attempts[0]?.inferenceStartedAt);
  }));

void test("invalid Text input creates no AI Import Attempt", () =>
  withFixture(async ({ caller, db, householdId }) => {
    await assert.rejects(caller.importFromText({ text: "   " }));
    assert.equal(await db.aiImportAttempt.count({ where: { householdId } }), 0);
  }));

void test("an unauthorized Text request creates no AI Import Attempt", () =>
  withFixture(async ({ db, householdId }) => {
    const caller = dinnerRouter.createCaller({
      db,
      auth: { userId: null },
    } as unknown as Parameters<typeof dinnerRouter.createCaller>[0]);

    await assert.rejects(
      caller.importFromText({ text: "A tomato soup recipe" }),
    );
    assert.equal(await db.aiImportAttempt.count({ where: { householdId } }), 0);
  }));
