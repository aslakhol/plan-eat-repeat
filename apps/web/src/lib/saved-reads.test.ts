import assert from "node:assert/strict";
import { test } from "node:test";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { createTRPCReact, getQueryKey } from "@trpc/react-query";
import superjson from "superjson";
import type { AppRouter } from "~/server/api/root";
import type { RouterOutputs } from "~/utils/api";
import {
  restoreSavedReads,
  saveConfirmedRead,
  SAVED_READS_KEY,
} from "./saved-reads";

const api = createTRPCReact<AppRouter>();
const monday = new Date("2026-10-05T00:00:00+02:00");
const planKey = getQueryKey(
  api.plan.weekOverview,
  { startOfWeek: monday },
  "query",
);
const listKey = getQueryKey(api.shoppingList.list, undefined, "query");
const status = {
  userId: "user",
  sessionId: "session",
  householdId: "household",
  welcomeSeenAt: null,
};
const plan = {
  plans: [{ id: 1, date: monday, dinner: { id: 1, name: "Soup" } }],
  appStatus: status,
};
const item = {
  id: "shopping-item",
  ownItemId: "own-item",
  householdId: "household",
  amount: 2,
  unit: "l",
  revision: "revision",
  name: "Milk",
  normalizedName: "milk",
  note: null,
  ownItem: {
    id: "own-item",
    householdId: "household",
    name: "Milk",
    normalizedName: "milk",
    note: null,
    normalizedNote: "",
    category: "DAIRY",
    usuallyHave: false,
    odaProductId: null,
    odaProductName: null,
    odaProductDescription: null,
  },
} satisfies RouterOutputs["shoppingList"]["list"]["items"][number];
const list = {
  items: [item],
  shoppingLanguage: "no",
  appStatus: status,
} satisfies RouterOutputs["shoppingList"]["list"];

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

void test("restores exact weeks, Dates, shopping rows and successful empty reads as stale data", (t) => {
  const disk = storage();
  saveConfirmedRead(disk, planKey, plan);
  saveConfirmedRead(disk, listKey, list);
  const recentKey = getQueryKey(api.shoppingList.recent, undefined, "query");
  saveConfirmedRead(disk, recentKey, { items: [], appStatus: status });
  const client = new QueryClient();
  t.after(() => client.clear());
  restoreSavedReads(disk, client);
  assert.deepEqual(client.getQueryData(planKey), { ...plan, appStatus: null });
  assert.deepEqual(client.getQueryData(listKey), { ...list, appStatus: null });
  assert.deepEqual(client.getQueryData(recentKey), {
    items: [],
    appStatus: null,
  });
  assert.equal(client.getQueryState(planKey)?.isInvalidated, true);
  const nextWeek = getQueryKey(
    api.plan.weekOverview,
    { startOfWeek: new Date("2026-10-12T00:00:00+02:00") },
    "query",
  );
  assert.equal(client.getQueryData(nextWeek), undefined);
  // A read or a write already in this visit must win over disk.
  client.setQueryData(listKey, { ...list, items: [] });
  restoreSavedReads(disk, client);
  assert.deepEqual(client.getQueryData(listKey), { ...list, items: [] });
});

void test("only successful fetches persist; optimistic patches, failed refreshes and cancelled reads do not", async (t) => {
  const disk = storage();
  const client = new QueryClient({
    queryCache: new QueryCache({
      onSuccess: (data, query) => saveConfirmedRead(disk, query.queryKey, data),
    }),
    defaultOptions: { queries: { retry: false } },
  });
  t.after(() => client.clear());
  await client.fetchQuery({
    queryKey: listKey,
    queryFn: () => Promise.resolve(list),
  });
  client.setQueryData(listKey, { ...list, items: [] });
  const late = Promise.withResolvers<typeof list>();
  const fetching = client.fetchQuery({
    queryKey: listKey,
    queryFn: () => late.promise,
  });
  await client.cancelQueries({ queryKey: listKey });
  await fetching;
  late.resolve({ ...list, items: [] });
  const reopened = new QueryClient();
  t.after(() => reopened.clear());
  restoreSavedReads(disk, reopened);
  assert.deepEqual(reopened.getQueryData(listKey), {
    ...list,
    appStatus: null,
  });
  await assert.rejects(
    reopened.fetchQuery({
      queryKey: listKey,
      queryFn: () => Promise.reject(new Error("offline")),
    }),
  );
  assert.deepEqual(reopened.getQueryData(listKey), {
    ...list,
    appStatus: null,
  });
  await client.fetchQuery({
    queryKey: listKey,
    queryFn: () => Promise.resolve({ ...list, items: [] }),
  });
  reopened.clear();
  restoreSavedReads(disk, reopened);
  assert.deepEqual(reopened.getQueryData(listKey), {
    ...list,
    items: [],
    appStatus: null,
  });
});

void test("corrupt, expired and incompatible entries fall back to reads; storage failure is harmless", (t) => {
  const disk = storage();
  const client = new QueryClient();
  t.after(() => client.clear());
  for (const raw of [
    "broken JSON",
    superjson.stringify([
      { queryKey: listKey, data: { items: [null] }, confirmedAt: Date.now() },
    ]),
    superjson.stringify([
      { queryKey: listKey, data: { ...list, appStatus: null }, confirmedAt: 1 },
    ]),
  ]) {
    disk.setItem(SAVED_READS_KEY, raw);
    restoreSavedReads(disk, client);
    assert.equal(client.getQueryData(listKey), undefined);
  }
  saveConfirmedRead(disk, listKey, list);
  restoreSavedReads(disk, client);
  assert.deepEqual(client.getQueryData(listKey), { ...list, appStatus: null });
  const denied = {
    getItem: () => {
      throw new Error("denied");
    },
    setItem: () => {
      throw new Error("quota");
    },
  };
  assert.doesNotThrow(() => saveConfirmedRead(denied, listKey, list));
  assert.doesNotThrow(() => restoreSavedReads(denied, client));
});

void test("keeps shopping reads while bounding saved weeks and excludes unrelated queries", (t) => {
  const disk = storage();
  saveConfirmedRead(disk, listKey, list);
  for (let index = 0; index < 10; index++) {
    const date = new Date(monday.getTime() + index * 7 * 86400000);
    saveConfirmedRead(
      disk,
      getQueryKey(api.plan.weekOverview, { startOfWeek: date }, "query"),
      plan,
    );
  }
  const privateKey = getQueryKey(api.household.household, undefined, "query");
  saveConfirmedRead(disk, privateKey, list);
  const client = new QueryClient();
  t.after(() => client.clear());
  restoreSavedReads(disk, client);
  assert.equal(client.getQueryCache().getAll().length, 6);
  assert.deepEqual(client.getQueryData(listKey), { ...list, appStatus: null });
  assert.equal(client.getQueryData(privateKey), undefined);
});
