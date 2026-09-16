import assert from "node:assert/strict";
import { mock, test, type TestContext } from "node:test";
import { QueryClient, type QueryClientConfig } from "@tanstack/react-query";

const notify = mock.fn<(options: { description: string }) => void>();
let createClient!: () => QueryClient;
mock.module("@trpc/next", {
  namedExports: {
    createTRPCNext: ({
      config,
    }: {
      config: () => { queryClientConfig: QueryClientConfig };
    }) => {
      createClient = () => new QueryClient(config().queryClientConfig);
      return {};
    },
  },
});
mock.module(new URL("../components/ui/use-toast.ts", import.meta.url).href, {
  namedExports: { toast: notify },
});
await import("./api");

function setup(t: TestContext) {
  notify.mock.resetCalls();
  const client = createClient();
  t.after(() => client.clear());
  return client;
}

void test("failed refreshes keep cached shopping data and error feedback without toasts", async (t) => {
  const client = setup(t);
  const queryKey = ["shoppingList", "list"];
  const items = [{ name: "Milk" }];
  client.setQueryData(queryKey, items);
  const error = new Error("No connection");

  // Resume and subsequent polling can both fail before connectivity returns.
  for (let attempt = 0; attempt < 2; attempt++) {
    await assert.rejects(
      client.fetchQuery({
        queryKey,
        queryFn: () => Promise.reject(error),
        retry: false,
      }),
      error,
    );
  }

  assert.equal(notify.mock.callCount(), 0);
  assert.deepEqual(client.getQueryData(queryKey), items);
  assert.equal(client.getQueryState(queryKey)?.error, error);

  await client.fetchQuery({ queryKey, queryFn: () => Promise.resolve(items) });
  assert.equal(client.getQueryState(queryKey)?.error, null);
});

void test("an initial request that recovers during retries produces no toast", async (t) => {
  const client = setup(t);
  let attempts = 0;
  const items = await client.fetchQuery({
    queryKey: ["shoppingList", "list"],
    queryFn: () => {
      attempts++;
      return attempts === 1
        ? Promise.reject(new Error("No connection"))
        : Promise.resolve(["Milk"]);
    },
    retry: 1,
    retryDelay: 0,
  });
  assert.deepEqual(items, ["Milk"]);
  assert.equal(notify.mock.callCount(), 0);
});

void test("an initial request that exhausts retries still reports failure", async (t) => {
  const client = setup(t);
  const error = new Error("No connection");
  await assert.rejects(
    client.fetchQuery({
      queryKey: ["shoppingList", "list"],
      queryFn: () => Promise.reject(error),
      retry: 1,
      retryDelay: 0,
    }),
    error,
  );
  assert.equal(notify.mock.callCount(), 1);
  assert.equal(notify.mock.calls[0]?.arguments[0].description, error.message);
});

void test("a failed user action still reports failure", async (t) => {
  const client = setup(t);
  const error = new Error("No connection");
  const mutation = client.getMutationCache().build(client, {
    mutationFn: () => Promise.reject(error),
  });
  await assert.rejects(mutation.execute(undefined), error);
  assert.equal(notify.mock.callCount(), 1);
  assert.equal(notify.mock.calls[0]?.arguments[0].description, error.message);
});
