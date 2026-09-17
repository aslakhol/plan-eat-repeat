import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { MockLanguageModelV3 } from "ai/test";
import { createPrismaClient } from "@planeatrepeat/db";
import { z } from "zod";

const { loadEnvConfig } = createRequire(import.meta.url)(
  "@next/env",
) as typeof import("@next/env");
loadEnvConfig(process.cwd());
process.env.ODA_CREDENTIAL_KEY = Buffer.alloc(32, 8).toString("base64");
process.env.ANTHROPIC_API_KEY = "test-key";
const milk = {
  id: 10,
  name: "Milk",
  description: "1 l",
  price: "20.00",
  unitPrice: "20.00",
  unitName: "liter",
  availability: { isAvailable: true },
};
const eggs = { ...milk, id: 20, name: "Eggs", description: "6 pcs" };
let selections: {
  requirementId: string;
  productId: number | null;
  quantity: number | null;
  measurement?: {
    amount: number;
    unit: string;
    packAmount: number;
    packUnit: string;
  } | null;
}[] = [];
let products = [milk, eggs];
let suggestions: (typeof milk)[] = [];
let previousOrders: (typeof milk)[] = [];
let historySearch = new Map<string, (typeof milk)[]>();
let cart = new Map<number, number>();
let added: { productId: number; quantity: number }[] = [];
let beforeAdd = () => Promise.resolve();
let afterAdd = () => Promise.resolve();
let beforeModel = () => Promise.resolve();
const cartResponse = () => ({
  url: "https://oda.com/no/cart/",
  groups: [
    {
      items: [...cart].map(([id, quantity]) => ({
        product: [...products, ...[...historySearch.values()].flat()].find(
          (p) => p.id === id,
        )!,
        quantity,
      })),
    },
  ],
});
mock.module("@clerk/nextjs/server", {
  namedExports: {
    clerkClient: () => {
      throw new Error("Unexpected Clerk access");
    },
    getAuth: () => ({ userId: null }),
  },
});
mock.module("@modelcontextprotocol/sdk/client/index.js", {
  namedExports: {
    Client: class {
      connect() {
        return Promise.resolve();
      }
      close() {
        return Promise.resolve();
      }
      async callTool(input: { name: string; arguments: unknown }) {
        if (input.name === "get_cart")
          return { structuredContent: cartResponse() };
        if (input.name === "likely_to_buy")
          return { structuredContent: { result: suggestions } };
        if (input.name === "get_orders")
          return {
            structuredContent: {
              orders: [
                { products: previousOrders.map((product) => ({ product })) },
              ],
            },
          };
        if (input.name === "product_search") {
          const { queries } = z
            .object({ queries: z.array(z.string()) })
            .parse(input.arguments);
          return {
            structuredContent: {
              result: queries.map((query) => ({
                query,
                products: historySearch.get(query) ?? products,
                hasMore: false,
              })),
            },
          };
        }
        if (input.name === "manipulate_cart") {
          const { operations } = z
            .object({
              operations: z.array(
                z.object({
                  productId: z.number(),
                  quantity: z.number().positive(),
                }),
              ),
            })
            .parse(input.arguments);
          await beforeAdd();
          for (const operation of operations) {
            added.push(operation);
            cart.set(
              operation.productId,
              (cart.get(operation.productId) ?? 0) + operation.quantity,
            );
          }
          await afterAdd();
          return { structuredContent: cartResponse() };
        }
        throw new Error(`Unexpected Oda tool ${input.name}`);
      }
    },
  },
});
const model = new MockLanguageModelV3({
  doGenerate: async () => {
    await beforeModel();
    return {
      content: [{ type: "text", text: JSON.stringify({ selections }) }],
      finishReason: { unified: "stop", raw: "end_turn" },
      usage: {
        inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 20, text: 20, reasoning: 0 },
      },
      warnings: [],
    };
  },
});
mock.module("@ai-sdk/anthropic", { namedExports: { anthropic: () => model } });
const { odaRouter } = await import("../api/routers/oda");
const { shoppingListRouter } = await import("../api/routers/shoppingList");

async function withHousehold(
  run: (fixture: {
    oda: ReturnType<typeof odaRouter.createCaller>;
    member: ReturnType<typeof odaRouter.createCaller>;
    shopping: ReturnType<typeof shoppingListRouter.createCaller>;
  }) => Promise<void>,
) {
  const db = createPrismaClient(process.env.DATABASE_URL!);
  const marker = crypto.randomUUID();
  const users = [0, 1].map((n) => `oda-send-${marker}-${n}`);
  await db.user.createMany({ data: users.map((id) => ({ id })) });
  const household = await db.household.create({
    data: {
      name: marker,
      slug: marker,
      Members: { create: users.map((userId) => ({ userId, role: "MEMBER" })) },
    },
  });
  const context = (n: number) =>
    ({ db, auth: { userId: users[n]! } }) as Parameters<
      typeof odaRouter.createCaller
    >[0];
  const oda = odaRouter.createCaller(context(0));
  const fetchMock = mock.method(globalThis, "fetch", () =>
    Promise.resolve(
      Response.json({
        client_id: "test-client",
        access_token: "test-token",
        refresh_token: "test-refresh",
        expires_in: 3600,
        token_type: "Bearer",
      }),
    ),
  );
  try {
    const { url } = await oda.connect();
    await oda.callback({
      state: new URL(url).searchParams.get("state")!,
      code: "test-code",
    });
    await run({
      oda,
      member: odaRouter.createCaller(context(1)),
      shopping: shoppingListRouter.createCaller(context(0)),
    });
  } finally {
    fetchMock.mock.restore();
    await db.household.delete({ where: { id: household.id } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  }
}

void test("an ordinary member sends a modest pack, completes the item, and retries without another addition", () =>
  withHousehold(async ({ oda, member, shopping }) => {
    cart = new Map();
    added = [];
    products = [milk, eggs];
    const item = await shopping.addManual({ name: "Milk" });
    selections = [
      { requirementId: item.id, productId: milk.id, quantity: null },
    ];
    const id = crypto.randomUUID();
    const result = await member.send({ id });
    assert.equal(result.state, "COMPLETED");
    assert.deepEqual(added, [{ productId: 10, quantity: 1 }]);
    assert.deepEqual(await shopping.list(), []);
    assert.equal((await shopping.recent())[0]?.ownItemId, item.ownItemId);
    await shopping.addManual({ name: "Milk" });
    await oda.send({ id });
    assert.equal(added.length, 1);
    assert.equal((await shopping.list()).length, 1);
  }));

void test("existing cart contents cover matching unspecified items while unavailable and invented products stay on the list", () =>
  withHousehold(async ({ oda, shopping }) => {
    cart = new Map([[10, 2]]);
    added = [];
    products = [milk, { ...eggs, availability: { isAvailable: false } }];
    const covered = await shopping.addManual({ name: "Milk" });
    const unavailable = await shopping.addManual({ name: "Eggs" });
    const invented = await shopping.addManual({ name: "Bread" });
    const unrelated = await shopping.addManual({ name: "qzxvplmn" });
    selections = [
      { requirementId: covered.id, productId: 10, quantity: null },
      { requirementId: unavailable.id, productId: 20, quantity: null },
      { requirementId: invented.id, productId: 999, quantity: null },
      { requirementId: unrelated.id, productId: null, quantity: null },
    ];
    await oda.send({ id: crypto.randomUUID() });
    assert.deepEqual(added, []);
    assert.equal(cart.get(10), 2);
    assert.deepEqual(
      new Set((await shopping.list()).map((item) => item.id)),
      new Set([unavailable.id, invented.id, unrelated.id]),
    );
    assert.equal((await shopping.recent())[0]?.ownItemId, covered.ownItemId);
  }));

void test("unresolved quantities remain on the list when the model supplies no usable interpretation", () =>
  withHousehold(async ({ oda, shopping }) => {
    cart = new Map();
    added = [];
    products = [milk, eggs];
    const numeric = await shopping.addManual({ name: "Milk" });
    await shopping.edit({ ...numeric, amount: 2, unit: "l" });
    const textual = await shopping.addManual({ name: "Two eggs" });
    selections = [
      { requirementId: numeric.id, productId: 10, quantity: null },
      { requirementId: textual.id, productId: null, quantity: null },
    ];
    await oda.send({ id: crypto.randomUUID() });
    assert.deepEqual(added, []);
    assert.equal((await shopping.list()).length, 2);
  }));

void test("a delayed transfer preserves edits and additions and coordinates both Household members", () =>
  withHousehold(async ({ oda, member, shopping }) => {
    cart = new Map();
    added = [];
    products = [milk, eggs];
    const item = await shopping.addManual({ name: "Milk" });
    selections = [{ requirementId: item.id, productId: 10, quantity: null }];
    const started = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    beforeAdd = () => {
      started.resolve();
      return release.promise;
    };
    const id = crypto.randomUUID();
    const sending = oda.send({ id });
    try {
      await started.promise;
      assert.equal((await member.send({ id: crypto.randomUUID() })).id, id);
      await assert.rejects(member.disconnect());
      await shopping.edit({ ...item, amount: 3 });
      await shopping.addManual({ name: "Eggs" });
    } finally {
      release.resolve();
      beforeAdd = () => Promise.resolve();
    }
    await sending;
    assert.deepEqual(added, [{ productId: 10, quantity: 1 }]);
    assert.equal((await shopping.list()).length, 2);
    assert.deepEqual(await shopping.recent(), []);
    await withHousehold(async ({ oda: other }) => {
      assert.equal(await other.transfer(), null);
      await assert.rejects(other.send({ id }));
    });
  }));

void test("partial success completes only confirmed items and an ambiguous write blocks a fresh send", () =>
  withHousehold(async ({ oda, shopping }) => {
    cart = new Map();
    added = [];
    products = [milk, eggs];
    const first = await shopping.addManual({ name: "Milk" });
    const second = await shopping.addManual({ name: "Eggs" });
    selections = [
      { requirementId: first.id, productId: 10, quantity: null },
      { requirementId: second.id, productId: 20, quantity: null },
    ];
    let writes = 0;
    beforeAdd = () =>
      ++writes === 1
        ? Promise.resolve()
        : Promise.reject(new Error("Ambiguous timeout"));
    try {
      const result = await oda.send({ id: crypto.randomUUID() });
      assert.equal(result.state, "UNCERTAIN");
      assert.equal(added.length, 1);
      assert.equal((await shopping.list()).length, 1);
      assert.equal((await shopping.recent()).length, 1);
      assert.equal((await oda.send({ id: crypto.randomUUID() })).id, result.id);
      assert.equal(writes, 2);
    } finally {
      beforeAdd = () => Promise.resolve();
    }
  }));

void test("explicit quantities add in full while overlapping unspecified needs add no extra pack", () =>
  withHousehold(async ({ oda, shopping }) => {
    cart = new Map([[10, 1]]);
    added = [];
    products = [milk, eggs];
    const explicit = await shopping.addManual({ name: "Milk" });
    await shopping.edit({ ...explicit, amount: 2, unit: "l" });
    const unspecified = await shopping.addManual({ name: "Milk" });
    selections = [
      { requirementId: explicit.id, productId: 10, quantity: 2 },
      { requirementId: unspecified.id, productId: 10, quantity: null },
    ];
    await oda.send({ id: crypto.randomUUID() });
    assert.deepEqual(added, [{ productId: 10, quantity: 2 }]);
    assert.equal(cart.get(10), 3);
    assert.deepEqual(await shopping.list(), []);
    assert.equal((await shopping.recent()).length, 1);
  }));

void test("known unit conversions override estimates and round overlapping representations together", () =>
  withHousehold(async ({ oda, shopping }) => {
    const flour = {
      ...milk,
      id: 30,
      name: "Flour",
      description: "1 kg",
      unitName: "kg",
    };
    cart = new Map();
    added = [];
    products = [flour];
    const weight = await shopping.addManual({ name: "Flour" });
    await shopping.edit({ ...weight, amount: 2500, unit: "g" });
    const cups = await shopping.addManual({ name: "Flour" });
    await shopping.edit({ ...cups, amount: 10, unit: "cup" });
    selections = [
      {
        requirementId: weight.id,
        productId: 30,
        quantity: 1,
        measurement: { amount: 2500, unit: "g", packAmount: 1, packUnit: "kg" },
      },
      {
        requirementId: cups.id,
        productId: 30,
        quantity: 1.25,
        measurement: { amount: 10, unit: "cup", packAmount: 1, packUnit: "kg" },
      },
    ];
    await oda.send({ id: crypto.randomUUID() });
    assert.deepEqual(added, [{ productId: 30, quantity: 3 }]);
    assert.deepEqual(await shopping.list(), []);
  }));

void test("text quantities, missing units, and ingredient counts use packs while incompatible notes stay separate", () =>
  withHousehold(async ({ oda, shopping }) => {
    const duck = {
      ...eggs,
      id: 21,
      name: "Duck eggs",
      description: "6 pcs",
      unitName: "kg",
    };
    const spinach = {
      ...milk,
      id: 40,
      name: "Spinach",
      description: "200 g",
      unitName: "kg",
    };
    cart = new Map();
    added = [];
    products = [eggs, duck, spinach];
    const numeric = await shopping.addManual({ name: "Eggs" });
    await shopping.edit({ ...numeric, amount: 2, unit: null, note: "hen" });
    const textual = await shopping.addManual({ name: "Two hen eggs" });
    const distinct = await shopping.addManual({ name: "Eggs" });
    await shopping.edit({ ...distinct, note: "duck", amount: 2 });
    const vague = await shopping.addManual({ name: "A handful of spinach" });
    selections = [
      {
        requirementId: numeric.id,
        productId: 20,
        quantity: 2 / 6,
        measurement: { amount: 2, unit: "pcs", packAmount: 6, packUnit: "pcs" },
      },
      { requirementId: textual.id, productId: 20, quantity: 2 / 6 },
      { requirementId: distinct.id, productId: 21, quantity: 2 / 6 },
      {
        requirementId: vague.id,
        productId: 40,
        quantity: 0.2,
        measurement: {
          amount: 1,
          unit: "handful",
          packAmount: 200,
          packUnit: "g",
        },
      },
    ];
    await oda.send({ id: crypto.randomUUID() });
    assert.deepEqual(
      added.sort((a, b) => a.productId - b.productId),
      [
        { productId: 20, quantity: 1 },
        { productId: 21, quantity: 1 },
        { productId: 40, quantity: 1 },
      ],
    );
    assert.deepEqual(await shopping.list(), []);
    const recent = await shopping.recent();
    assert.equal(recent.find((item) => item.note === "duck")?.amount, 2);
    assert.equal(recent.find((item) => item.note === "hen")?.amount, 2);
  }));

void test("decimal measurements exactly covering a pack do not round up a second pack", () =>
  withHousehold(async ({ oda, shopping }) => {
    const flour = {
      ...milk,
      id: 30,
      name: "Flour",
      description: "0.7 kg",
      unitName: "kg",
    };
    cart = new Map();
    added = [];
    products = [flour];
    const item = await shopping.addManual({ name: "Flour" });
    await shopping.edit({ ...item, amount: 700, unit: "g" });
    selections = [
      {
        requirementId: item.id,
        productId: 30,
        quantity: 1,
        measurement: {
          amount: 700,
          unit: "g",
          packAmount: 0.7,
          packUnit: "kg",
        },
      },
    ];
    await oda.send({ id: crypto.randomUUID() });
    assert.deepEqual(added, [{ productId: 30, quantity: 1 }]);
  }));

void test("existing-cart coverage completes independently of an uncertain explicit addition", () =>
  withHousehold(async ({ oda, shopping }) => {
    cart = new Map([[10, 1]]);
    added = [];
    products = [milk];
    const explicit = await shopping.addManual({ name: "Milk" });
    await shopping.edit({ ...explicit, amount: 2, unit: "l" });
    const covered = await shopping.addManual({ name: "Milk" });
    selections = [
      { requirementId: explicit.id, productId: 10, quantity: 2 },
      { requirementId: covered.id, productId: 10, quantity: null },
    ];
    beforeAdd = () => Promise.reject(new Error("Ambiguous write"));
    try {
      assert.equal(
        (await oda.send({ id: crypto.randomUUID() })).state,
        "UNCERTAIN",
      );
      assert.deepEqual(
        (await shopping.list()).map((item) => item.id),
        [explicit.id],
      );
      assert.equal(cart.get(10), 1);
    } finally {
      beforeAdd = () => Promise.resolve();
    }
  }));

void test("usual purchases are revalidated and can be selected beyond ordinary search results", () =>
  withHousehold(async ({ oda, shopping }) => {
    const usual = { ...milk, id: 11, name: "Usual milk" };
    cart = new Map();
    added = [];
    products = [milk];
    suggestions = [usual];
    historySearch = new Map([[usual.name, [usual]]]);
    try {
      const item = await shopping.addManual({ name: "Milk" });
      selections = [{ requirementId: item.id, productId: 11, quantity: null }];
      await oda.send({ id: crypto.randomUUID() });
      assert.deepEqual(added, [{ productId: 11, quantity: 1 }]);
      assert.deepEqual(await shopping.list(), []);
    } finally {
      suggestions = [];
      historySearch = new Map();
    }
  }));

void test("empty suggestions fall back to recent orders without sharing history between Households", () =>
  withHousehold(async ({ oda, shopping }) => {
    const usual = { ...milk, id: 11, name: "Usual milk" };
    cart = new Map();
    added = [];
    products = [milk];
    suggestions = [];
    previousOrders = [usual];
    historySearch = new Map([[usual.name, [usual]]]);
    try {
      const item = await shopping.addManual({ name: "Milk" });
      selections = [{ requirementId: item.id, productId: 11, quantity: null }];
      await oda.send({ id: crypto.randomUUID() });
      assert.deepEqual(added, [{ productId: 11, quantity: 1 }]);
      previousOrders = [];
      cart = new Map();
      added = [];
      await withHousehold(async ({ oda: other, shopping: otherList }) => {
        const another = await otherList.addManual({ name: "Milk" });
        selections = [
          { requirementId: another.id, productId: 11, quantity: null },
        ];
        await other.send({ id: crypto.randomUUID() });
        assert.deepEqual(added, []);
        assert.equal((await otherList.list()).length, 1);
      });
    } finally {
      previousOrders = [];
      historySearch = new Map();
    }
  }));

void test("historical availability cannot authorize an unavailable product and ordinary matching remains available", () =>
  withHousehold(async ({ oda, shopping }) => {
    const usual = { ...milk, id: 11, name: "Usual milk" };
    cart = new Map();
    added = [];
    products = [milk];
    suggestions = [usual];
    historySearch = new Map([
      [usual.name, [{ ...usual, availability: { isAvailable: false } }]],
    ]);
    try {
      const item = await shopping.addManual({ name: "Milk" });
      selections = [{ requirementId: item.id, productId: 11, quantity: null }];
      await oda.send({ id: crypto.randomUUID() });
      assert.deepEqual(added, []);
      assert.equal((await shopping.list()).length, 1);
      selections = [{ requirementId: item.id, productId: 10, quantity: null }];
      await oda.send({ id: crypto.randomUUID() });
      assert.deepEqual(added, [{ productId: 10, quantity: 1 }]);
      assert.deepEqual(await shopping.list(), []);
    } finally {
      suggestions = [];
      historySearch = new Map();
    }
  }));

void test("an ambiguous unspecified addition can recover established cart coverage without replay", () =>
  withHousehold(async ({ oda, member, shopping }) => {
    cart = new Map();
    added = [];
    products = [milk];
    const item = await shopping.addManual({ name: "Milk" });
    selections = [{ requirementId: item.id, productId: 10, quantity: null }];
    afterAdd = () =>
      Promise.reject(new Error("Response lost after remote success"));
    try {
      const transfer = await oda.send({ id: crypto.randomUUID() });
      assert.equal(transfer.state, "UNCERTAIN");
      assert.equal(cart.get(10), 1);
      afterAdd = () => Promise.resolve();
      assert.equal(
        (await member.recover({ id: transfer.id })).state,
        "COMPLETED",
      );
      assert.deepEqual(added, [{ productId: 10, quantity: 1 }]);
      assert.deepEqual(await shopping.list(), []);
      assert.equal((await shopping.recent())[0]?.ownItemId, item.ownItemId);
    } finally {
      afterAdd = () => Promise.resolve();
    }
  }));
