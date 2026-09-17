import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { createPrismaClient } from "@planeatrepeat/db";

const { loadEnvConfig } = createRequire(import.meta.url)(
  "@next/env",
) as typeof import("@next/env");
loadEnvConfig(process.cwd());
process.env.ODA_CREDENTIAL_KEY = Buffer.alloc(32, 7).toString("base64");
mock.module("@clerk/nextjs/server", {
  namedExports: {
    clerkClient: () => {
      throw new Error("Unexpected Clerk access");
    },
    getAuth: () => ({ userId: null }),
  },
});
const cartResult = { url: "https://oda.com/no/cart/" };
mock.module("@modelcontextprotocol/sdk/client/index.js", {
  namedExports: {
    Client: class {
      connect() {
        return Promise.resolve();
      }
      callTool() {
        return Promise.resolve({ structuredContent: cartResult });
      }
      close() {
        return Promise.resolve();
      }
    },
  },
});
const { odaRouter } = await import("../api/routers/oda");

void test("Oda authorization belongs to its initiating member and Household", async () => {
  const db = createPrismaClient(process.env.DATABASE_URL!);
  const marker = crypto.randomUUID();
  const users = [0, 1, 2].map((n) => `oda-${marker}-${n}`);
  await db.user.createMany({ data: users.map((id) => ({ id })) });
  const households = await Promise.all(
    [0, 1].map((n) =>
      db.household.create({
        data: {
          name: marker,
          slug: `${marker}-${n}`,
          Members: {
            create: (n === 0 ? users.slice(0, 2) : users.slice(2)).map(
              (userId) => ({ userId, role: "MEMBER" }),
            ),
          },
        },
      }),
    ),
  );
  const caller = (n: number) =>
    odaRouter.createCaller({ db, auth: { userId: users[n]! } } as Parameters<
      typeof odaRouter.createCaller
    >[0]);
  let expiresIn = 3600;
  let refreshFails = false;
  const fetchMock = mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      await Promise.resolve();
      const url = input instanceof Request ? input.url : input.toString();
      if (url.endsWith("register/"))
        return Response.json({ client_id: "app-client" });
      if (url.endsWith("token/")) {
        if (
          refreshFails &&
          init?.body instanceof URLSearchParams &&
          init.body.get("grant_type") === "refresh_token"
        )
          return new Response(null, { status: 400 });
        return Response.json({
          access_token: "private-access",
          refresh_token: "private-refresh",
          expires_in: expiresIn,
          token_type: "Bearer",
        });
      }
      if (url.endsWith("revoke_token/"))
        return new Response(null, { status: 200 });
      throw new Error(`Unexpected provider request: ${url}`);
    },
  );
  try {
    assert.deepEqual(await caller(0).status(), {
      connected: false,
      reconnectRequired: false,
    });
    const { url } = await caller(0).connect();
    const authorization = new URL(url);
    assert.equal(
      authorization.searchParams.get("code_challenge_method"),
      "S256",
    );
    const state = authorization.searchParams.get("state")!;
    await assert.rejects(caller(1).callback({ state, code: "code" }));
    await assert.rejects(caller(2).callback({ state, code: "code" }));
    await caller(0).callback({ state, code: "code" });
    assert.deepEqual(await caller(1).status(), {
      connected: true,
      reconnectRequired: false,
    });
    assert.deepEqual(await caller(2).status(), {
      connected: false,
      reconnectRequired: false,
    });
    await assert.rejects(caller(0).callback({ state, code: "code" }));
    assert.deepEqual(await caller(1).cart(), cartResult);
    await assert.rejects(caller(2).cart());
    expiresIn = 1;
    const reconnect = await caller(0).connect();
    await caller(0).callback({
      state: new URL(reconnect.url).searchParams.get("state")!,
      code: "code",
    });
    expiresIn = 3600;
    assert.deepEqual(await caller(1).cart(), cartResult);
    expiresIn = 1;
    const expired = await caller(0).connect();
    await caller(0).callback({
      state: new URL(expired.url).searchParams.get("state")!,
      code: "code",
    });
    refreshFails = true;
    await assert.rejects(caller(1).cart());
    assert.deepEqual(await caller(0).status(), {
      connected: true,
      reconnectRequired: true,
    });
    const pending = await caller(0).connect();
    await caller(1).disconnect();
    await assert.rejects(
      caller(0).callback({
        state: new URL(pending.url).searchParams.get("state")!,
        code: "code",
      }),
    );
    assert.deepEqual(await caller(0).status(), {
      connected: false,
      reconnectRequired: false,
    });
  } finally {
    fetchMock.mock.restore();
    await db.household.deleteMany({
      where: { id: { in: households.map((h) => h.id) } },
    });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  }
});
