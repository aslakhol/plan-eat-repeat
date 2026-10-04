import assert from "node:assert/strict";
import { test } from "node:test";
import { QueryClient } from "@tanstack/react-query";
import { observeAppReads } from "./app-status";

const session = { userId: "user", sessionId: "session" };
const status = { ...session, householdId: "household", welcomeSeenAt: null };
const absent = Object.assign(new Error("No household"), {
  data: { code: "FORBIDDEN", missingHousehold: session },
});
const fixture = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  let setups = 0;
  const statuses: string[] = [];
  const stop = observeAppReads(client.getQueryCache(), session, {
    onStatus: (data) => statuses.push(data.householdId!),
    onMissingHousehold: () => {
      setups += 1;
    },
  });
  return { client, stop, statuses, setups: () => setups };
};

void test("page reads begin immediately and report scope from empty authorized responses", async () => {
  const { client, stop, statuses, setups } = fixture();
  const response = Promise.withResolvers<{
    items: never[];
    appStatus: typeof status;
  }>();
  let reading = false;
  const pending = client.fetchQuery({
    queryKey: ["shopping"],
    queryFn: () => {
      reading = true;
      return response.promise;
    },
  });
  assert.equal(reading, true);
  assert.deepEqual(statuses, []);
  response.resolve({ items: [], appStatus: status });
  assert.deepEqual((await pending).items, []);
  assert.deepEqual(statuses, ["household"]);
  assert.equal(setups(), 0);
  stop();
  client.clear();
});

void test("concurrent missing-membership reads and Settings absence start setup once", async () => {
  const { client, stop, setups, statuses } = fixture();
  await Promise.all(
    ["plan", "shopping"].map(async (page) => {
      await assert.rejects(
        client.fetchQuery({
          queryKey: [page],
          queryFn: () => Promise.reject(absent),
        }),
      );
    }),
  );
  client.setQueryData(["settings"], {
    household: null,
    appStatus: { ...status, householdId: null },
  });
  assert.equal(setups(), 1);
  await client.fetchQuery({
    queryKey: ["plan"],
    queryFn: () => ({ plans: [], appStatus: status }),
  });
  assert.deepEqual(statuses, ["household"]);
  stop();
  client.clear();
});

void test("generic denials and late responses from other users or sessions never set up or adopt scope", async () => {
  const { client, stop, setups, statuses } = fixture();
  await assert.rejects(
    client.fetchQuery({
      queryKey: ["permission"],
      queryFn: () =>
        Promise.reject(
          Object.assign(new Error("Forbidden"), {
            data: { code: "FORBIDDEN" },
          }),
        ),
    }),
  );
  for (const identity of [
    { userId: "other", sessionId: "session" },
    { userId: "user", sessionId: "old" },
  ]) {
    client.setQueryData(["late", identity], {
      items: [],
      appStatus: { ...status, ...identity },
    });
    await assert.rejects(
      client.fetchQuery({
        queryKey: ["late-error", identity],
        queryFn: () =>
          Promise.reject(
            Object.assign(new Error("No household"), {
              data: { code: "FORBIDDEN", missingHousehold: identity },
            }),
          ),
      }),
    );
  }
  assert.equal(setups(), 0);
  assert.deepEqual(statuses, []);
  stop();
  client.clear();
});

void test("a known Household does not turn later permission loss into onboarding", async () => {
  const { client, stop, setups } = fixture();
  client.setQueryData(["plan"], { plans: [], appStatus: status });
  await assert.rejects(
    client.fetchQuery({
      queryKey: ["shopping"],
      queryFn: () => Promise.reject(absent),
    }),
  );
  assert.equal(setups(), 0);
  stop();
  client.clear();
});

void test("setup begins on the first missing-membership attempt while the read is still retrying", async () => {
  const { client, stop, setups } = fixture();
  const retry = Promise.withResolvers<{
    plans: never[];
    appStatus: typeof status;
  }>();
  let attempts = 0;
  const reading = client.fetchQuery({
    queryKey: ["plan"],
    queryFn: () => {
      attempts += 1;
      return attempts === 1 ? Promise.reject(absent) : retry.promise;
    },
    retry: 1,
    retryDelay: 0,
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(setups(), 1);
  retry.resolve({ plans: [], appStatus: status });
  await reading;
  stop();
  client.clear();
});
