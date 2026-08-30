import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

import { createPrismaClient } from "@planeatrepeat/db";

import { buildAiImportSpendReport } from "./ai-import-spend-report";

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
    const afterMembershipDeletion = await db.aiImportAttempt.findUniqueOrThrow({
      where: { id: attempt.id },
    });
    assert.equal(afterMembershipDeletion.membershipId, null);
    assert.equal(
      afterMembershipDeletion.membershipAttributionKey,
      membership.aiImportSpendAttributionKey,
    );

    const laterHousehold = await db.household.create({
      data: {
        name: `Later AI Import Attempt ${marker}`,
        slug: `later-ai-import-attempt-${marker}`,
        Members: { create: { userId, role: "MEMBER" } },
      },
      include: { Members: true },
    });
    const laterMembership = laterHousehold.Members[0];
    assert.ok(laterMembership);
    assert.notEqual(
      laterMembership.aiImportSpendAttributionKey,
      membership.aiImportSpendAttributionKey,
    );
    const retainedAttempt = await db.aiImportAttempt.findUniqueOrThrow({
      where: { id: attempt.id },
      include: { membership: true },
    });
    assert.equal(retainedAttempt.membership, null);
    await db.household.delete({ where: { id: laterHousehold.id } });

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
      where: {
        slug: {
          in: [
            `ai-import-attempt-${marker}`,
            `later-ai-import-attempt-${marker}`,
          ],
        },
      },
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
    await db.aiImportAttempt.updateMany({
      where: {
        id: attempt.id,
        supadataUnknownOperationCount: { gt: 0 },
      },
      data: {
        supadataCredits: { increment: 1 },
        supadataUnknownOperationCount: { decrement: 1 },
      },
    });
    const duplicateSettlement = await db.aiImportAttempt.updateMany({
      where: {
        id: attempt.id,
        supadataUnknownOperationCount: { gt: 0 },
      },
      data: {
        supadataCredits: { increment: 1 },
        supadataUnknownOperationCount: { decrement: 1 },
      },
    });
    const observed = await db.aiImportAttempt.findUniqueOrThrow({
      where: { id: attempt.id },
    });

    assert.equal(duplicateSettlement.count, 0);
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

void test("database-backed reporting interprets stale attempts without updating them", async () => {
  const db = createPrismaClient(databaseUrl);
  const marker = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const userId = `ai-import-stale-${marker}`;
  const attemptIds: string[] = [];

  try {
    await db.user.create({ data: { id: userId } });
    const household = await db.household.create({
      data: {
        name: `AI Import Stale ${marker}`,
        slug: `ai-import-stale-${marker}`,
        Members: { create: { userId, role: "ADMIN" } },
      },
      include: { Members: true },
    });
    const membership = household.Members[0];
    assert.ok(membership);

    for (const inferenceStartedAt of [
      null,
      new Date("2026-08-30T10:01:00.000Z"),
    ]) {
      const attempt = await db.aiImportAttempt.create({
        data: {
          source: "TEXT",
          startedAt: new Date("2026-08-30T10:00:00.000Z"),
          householdId: household.id,
          membershipId: membership.id,
          householdAttributionKey: household.aiImportSpendAttributionKey,
          membershipAttributionKey: membership.aiImportSpendAttributionKey,
          inferenceStartedAt,
        },
      });
      attemptIds.push(attempt.id);
    }

    const attempts = await db.aiImportAttempt.findMany({
      where: { id: { in: attemptIds } },
      select: {
        source: true,
        startedAt: true,
        householdAttributionKey: true,
        membershipAttributionKey: true,
        household: {
          select: {
            name: true,
            _count: { select: { Members: true } },
          },
        },
        membership: {
          select: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
        inferenceState: true,
        inferenceStartedAt: true,
        estimatedAiImportCostUsd: true,
        supadataOperationsStarted: true,
        supadataCredits: true,
        supadataUnknownOperationCount: true,
      },
    });
    const report = buildAiImportSpendReport({
      attempts,
      period: "7",
      chartOffset: 0,
      now: new Date("2026-08-30T12:00:00.000Z"),
      currentHouseholdCount: 1,
    });

    assert.equal(report.period.noChargeAttempts, 1);
    assert.equal(report.period.unknownInferenceAttempts, 1);
    assert.equal(report.period.pendingInferenceAttempts, 0);
    const storedAttempts = await db.aiImportAttempt.findMany({
      where: { id: { in: attemptIds } },
      select: { inferenceState: true },
    });
    assert.equal(storedAttempts.length, 2);
    assert.ok(
      storedAttempts.every((attempt) => attempt.inferenceState === "PENDING"),
    );
  } finally {
    await db.aiImportAttempt.deleteMany({ where: { id: { in: attemptIds } } });
    await db.household.deleteMany({
      where: { slug: `ai-import-stale-${marker}` },
    });
    await db.user.deleteMany({ where: { id: userId } });
    await db.$disconnect();
  }
});
