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

const modelIdentity = {
  providerId: "anthropic.messages",
  requestedModelId: "claude-opus-4-8",
} as const;

const inferenceUsage = {
  ...modelIdentity,
  responseModelId: "claude-opus-4-8-20260805",
  usage,
} as const;

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
        onInferenceStart(model: typeof modelIdentity): Promise<void> | void;
        onInferenceUsage(result: typeof inferenceUsage): Promise<void> | void;
      };
    }) => {
      await input.observer?.onInferenceStart(modelIdentity);
      await input.observer?.onInferenceUsage(inferenceUsage);
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
      providerId: "anthropic.messages",
      requestedModelId: "claude-opus-4-8",
      responseModelId: "claude-opus-4-8-20260805",
      totalInputTokens: 1_000,
      totalOutputTokens: 200,
      estimatedAiImportCostUsd: 0.01,
      supadataOperationsStarted: 0,
      supadataCredits: 0,
      supadataUnknownOperationCount: 0,
    });
    assert.ok(attempts[0]?.finishedAt);
    assert.ok(attempts[0]?.inferenceStartedAt);
  }));

void test("an accepted Photo mutation records exactly one priced attempt", () =>
  withFixture(async ({ caller, db, householdId }) => {
    const result = await caller.importFromImages({
      images: [{ data: "aGVsbG8=", mimeType: "image/jpeg" }],
    });
    assert.equal(result.name, "Tomato soup");

    const attempts = await db.aiImportAttempt.findMany({
      where: { householdId },
    });
    assert.equal(attempts.length, 1);
    assert.equal(attempts[0]?.source, "PHOTO");
    assert.equal(attempts[0]?.inferenceState, "ESTIMATED");
    assert.ok(attempts[0]?.finishedAt);
  }));

void test("an accepted Link mutation records one attempt and preserves its source URL", () =>
  withFixture(async ({ caller, db, householdId }) => {
    const sourceUrl = "https://example.com/tomato-soup";
    const fetchMock = mock.method(globalThis, "fetch", async () =>
      Promise.resolve(
        new Response(
          `<html><head><script type="application/ld+json">${JSON.stringify({
            "@type": "Recipe",
            name: "Tomato soup",
            recipeIngredient: ["Tomatoes"],
            recipeInstructions: ["Simmer"],
          })}</script></head><body></body></html>`,
          { headers: { "content-type": "text/html" } },
        ),
      ),
    );

    try {
      const result = await caller.importFromUrl({ url: sourceUrl });
      assert.equal(result.name, "Tomato soup");
      assert.equal(result.sourceUrl, sourceUrl);
    } finally {
      fetchMock.mock.restore();
    }

    const attempts = await db.aiImportAttempt.findMany({
      where: { householdId },
    });
    assert.equal(attempts.length, 1);
    assert.equal(attempts[0]?.source, "LINK");
    assert.equal(attempts[0]?.inferenceState, "ESTIMATED");
  }));

for (const { name, url, source } of [
  {
    name: "YouTube",
    url: "https://www.youtube.com/watch?v=BoFkDmTm2uc",
    source: "YOUTUBE",
  },
  {
    name: "Instagram",
    url: "https://www.instagram.com/reel/DOybkebkcaw/",
    source: "INSTAGRAM",
  },
] as const) {
  void test(`${name} acquisition failure retains its submitted Import Source`, () =>
    withFixture(async ({ caller, db, householdId }) => {
      const fetchMock = mock.method(globalThis, "fetch", async () =>
        Promise.resolve(
          Response.json(
            { error: "provider-unavailable" },
            { status: 503 },
          ),
        ),
      );

      try {
        await assert.rejects(caller.importFromUrl({ url }));
      } finally {
        fetchMock.mock.restore();
      }

      const attempts = await db.aiImportAttempt.findMany({
        where: { householdId },
      });
      assert.equal(attempts.length, 1);
      assert.equal(attempts[0]?.source, source);
      assert.equal(attempts[0]?.inferenceState, "NOT_INCURRED");
      assert.ok(attempts[0]?.finishedAt);
    }));
}

void test("invalid Text input creates no AI Import Attempt", () =>
  withFixture(async ({ caller, db, householdId }) => {
    await assert.rejects(caller.importFromText({ text: "   " }));
    assert.equal(await db.aiImportAttempt.count({ where: { householdId } }), 0);
  }));

void test("invalid Photo and URL input creates no AI Import Attempt", () =>
  withFixture(async ({ caller, db, householdId }) => {
    await assert.rejects(caller.importFromImages({ images: [] }));
    await assert.rejects(caller.importFromUrl({ url: "not a URL" }));
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
