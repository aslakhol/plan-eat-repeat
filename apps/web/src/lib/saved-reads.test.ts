import assert from "node:assert/strict";
import { test } from "node:test";
import { QueryClient } from "@tanstack/react-query";
import {
  persistQueryClientRestore,
  persistQueryClientSave,
} from "@tanstack/react-query-persist-client";
import { getQueryKey } from "@trpc/react-query";
import { api } from "~/utils/api";
import { createPersistenceOptions } from "./saved-reads";

void test("persists confirmed Plan and Shopping cache data, including after a failed refresh", async (t) => {
  const values = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
  const options = createPersistenceOptions(storage);
  const client = new QueryClient();
  const reopened = new QueryClient();
  t.after(() => {
    client.clear();
    reopened.clear();
  });
  const date = new Date("2026-10-05T00:00:00+02:00");
  const weekKey = getQueryKey(
    api.plan.weekOverview,
    { startOfWeek: date },
    "query",
  );
  const listKey = getQueryKey(api.shoppingList.list, undefined, "query");
  const otherKey = getQueryKey(api.shoppingList.sources, undefined, "query");
  const plan = { plans: [{ date, dinner: { id: 1, name: "Soup" } }] };
  client.setQueryData(weekKey, plan);
  client.setQueryData(listKey, { items: [{ name: "Milk" }] });
  // The shopping hooks patch the cache only after a server acknowledgement.
  client.setQueryData(listKey, { items: [] });
  client.setQueryData(otherKey, { items: [{ name: "Unrelated" }] });
  await assert.rejects(
    client.fetchQuery({
      queryKey: listKey,
      queryFn: () => Promise.reject(new Error("offline")),
      retry: false,
    }),
  );
  client.getMutationCache().build(
    client,
    { mutationKey: ["pending"] },
    {
      context: undefined,
      data: undefined,
      error: null,
      failureCount: 0,
      failureReason: null,
      isPaused: true,
      status: "pending",
      variables: undefined,
      submittedAt: Date.now(),
    },
  );
  await persistQueryClientSave({ ...options, queryClient: client });
  await persistQueryClientRestore({ ...options, queryClient: reopened });
  assert.deepEqual(reopened.getQueryData(weekKey), plan);
  assert.deepEqual(reopened.getQueryData(listKey), { items: [] });
  assert.equal(reopened.getQueryData(otherKey), undefined);
  assert.equal(reopened.getMutationCache().getAll().length, 0);
});
