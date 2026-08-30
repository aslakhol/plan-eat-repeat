import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

import { createPrismaClient } from "@planeatrepeat/db";

const { loadEnvConfig } = createRequire(import.meta.url)(
  "@next/env",
) as typeof import("@next/env");
loadEnvConfig(process.cwd());

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for integration tests");
}

void test("AI Import Attempt keeps anonymous attribution after live records are deleted", async () => {
  const db = createPrismaClient(databaseUrl);
  const marker = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const userId = `ai-import-attempt-${marker}`;
  let attemptId: string | null = null;

  try {
    await db.user.create({ data: { id: userId } });
    const household = await db.household.create({
      data: {
        name: `AI Import Attempt ${marker}`,
        slug: `ai-import-attempt-${marker}`,
        Members: { create: { userId, role: "ADMIN" } },
      },
      include: { Members: true },
    });
    const membership = household.Members[0];
    assert.ok(membership);
    assert.match(household.aiImportSpendAttributionKey, /^[0-9a-f-]{36}$/);
    assert.match(membership.aiImportSpendAttributionKey, /^[0-9a-f-]{36}$/);
    assert.notEqual(
      household.aiImportSpendAttributionKey,
      membership.aiImportSpendAttributionKey,
    );

    const attempt = await db.aiImportAttempt.create({
      data: {
        source: "TEXT",
        householdId: household.id,
        membershipId: membership.id,
        householdAttributionKey: household.aiImportSpendAttributionKey,
        membershipAttributionKey: membership.aiImportSpendAttributionKey,
      },
    });
    attemptId = attempt.id;
    assert.equal(attempt.inferenceState, "PENDING");
    assert.equal(attempt.supadataOperationsStarted, 0);
    assert.equal(attempt.supadataCredits, 0);
    assert.equal(attempt.supadataUnknownOperationCount, 0);

    await db.membership.delete({ where: { id: membership.id } });
    const afterMembershipDeletion =
      await db.aiImportAttempt.findUniqueOrThrow({
        where: { id: attempt.id },
      });
    assert.equal(afterMembershipDeletion.membershipId, null);
    assert.equal(
      afterMembershipDeletion.membershipAttributionKey,
      membership.aiImportSpendAttributionKey,
    );

    await db.household.delete({ where: { id: household.id } });
    const afterHouseholdDeletion = await db.aiImportAttempt.findUniqueOrThrow({
      where: { id: attempt.id },
    });
    assert.equal(afterHouseholdDeletion.householdId, null);
    assert.equal(
      afterHouseholdDeletion.householdAttributionKey,
      household.aiImportSpendAttributionKey,
    );
  } finally {
    if (attemptId) {
      await db.aiImportAttempt.deleteMany({ where: { id: attemptId } });
    }
    await db.household.deleteMany({
      where: { slug: `ai-import-attempt-${marker}` },
    });
    await db.user.deleteMany({ where: { id: userId } });
    await db.$disconnect();
  }
});

void test("Supadata attempt counters support atomic observation updates", async () => {
  const db = createPrismaClient(databaseUrl);
  const marker = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const userId = `ai-import-counter-${marker}`;
  let attemptId: string | null = null;

  try {
    await db.user.create({ data: { id: userId } });
    const household = await db.household.create({
      data: {
        name: `AI Import Counter ${marker}`,
        slug: `ai-import-counter-${marker}`,
        Members: { create: { userId, role: "ADMIN" } },
      },
      include: { Members: true },
    });
    const membership = household.Members[0];
    assert.ok(membership);
    const attempt = await db.aiImportAttempt.create({
      data: {
        source: "TEXT",
        householdId: household.id,
        membershipId: membership.id,
        householdAttributionKey: household.aiImportSpendAttributionKey,
        membershipAttributionKey: membership.aiImportSpendAttributionKey,
      },
    });
    attemptId = attempt.id;

    await db.aiImportAttempt.update({
      where: { id: attempt.id },
      data: {
        supadataOperationsStarted: { increment: 1 },
        supadataUnknownOperationCount: { increment: 1 },
      },
    });
    const observed = await db.aiImportAttempt.update({
      where: { id: attempt.id },
      data: {
        supadataCredits: { increment: 1 },
        supadataUnknownOperationCount: { decrement: 1 },
      },
    });

    assert.equal(observed.supadataOperationsStarted, 1);
    assert.equal(observed.supadataCredits, 1);
    assert.equal(observed.supadataUnknownOperationCount, 0);
  } finally {
    if (attemptId) {
      await db.aiImportAttempt.deleteMany({ where: { id: attemptId } });
    }
    await db.household.deleteMany({
      where: { slug: `ai-import-counter-${marker}` },
    });
    await db.user.deleteMany({ where: { id: userId } });
    await db.$disconnect();
  }
});
