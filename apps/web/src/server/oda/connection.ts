import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { PrismaClient } from "@planeatrepeat/db";
import { env } from "~/env";

const clientSchema = z.object({
  client_id: z.string(),
  client_secret: z.string().optional(),
});
const tokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  expires_in: z.number().positive(),
  token_type: z.string(),
});
const credentialsSchema = clientSchema.extend({
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  expiresAt: z.number(),
});
const authorizationSchema = clientSchema.extend({
  verifier: z.string(),
  redirectUri: z.string(),
});
const reconnect = () =>
  new TRPCError({
    code: "PRECONDITION_FAILED",
    message: "Reconnect Oda in Shopping List settings.",
  });

function key() {
  const value = Buffer.from(env.ODA_CREDENTIAL_KEY ?? "", "base64");
  if (value.length !== 32)
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Oda connection is not configured.",
    });
  return value;
}
function encrypt(value: unknown, householdId: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(householdId));
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}
function decrypt(value: string, householdId: string): unknown {
  const data = Buffer.from(value, "base64");
  const cipher = createDecipheriv("aes-256-gcm", key(), data.subarray(0, 12));
  cipher.setAAD(Buffer.from(householdId));
  cipher.setAuthTag(data.subarray(12, 28));
  return JSON.parse(
    Buffer.concat([cipher.update(data.subarray(28)), cipher.final()]).toString(
      "utf8",
    ),
  );
}
async function token(parameters: Record<string, string>) {
  const response = await fetch("https://oda.com/o/token/", {
    method: "POST",
    body: new URLSearchParams({
      ...parameters,
      resource: "https://oda.com/mcp",
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw reconnect();
  return tokenSchema.parse(await response.json());
}

export async function connectionStatus(db: PrismaClient, householdId: string) {
  const connection = await db.odaConnection.findUnique({
    where: { householdId },
    select: { reconnectRequired: true },
  });
  return {
    connected: !!connection,
    reconnectRequired: connection?.reconnectRequired ?? false,
  };
}

export async function connect(
  db: PrismaClient,
  householdId: string,
  userId: string,
) {
  key();
  const redirectUri = new URL("/api/oda/callback", env.NEXT_PUBLIC_APP_URL)
    .href;
  const response = await fetch("https://oda.com/o/register/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({
      client_name: "Plan Eat Repeat",
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
  });
  if (!response.ok)
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: "Could not connect to Oda. Try again.",
    });
  const client = clientSchema.parse(await response.json());
  const verifier = randomBytes(32).toString("base64url");
  const state = randomBytes(32).toString("base64url");
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Household" WHERE id = ${householdId} FOR UPDATE`;
    await tx.odaAuthorization.deleteMany({ where: { householdId } });
    await tx.odaAuthorization.create({
      data: {
        state,
        householdId,
        userId,
        credentials: encrypt({ ...client, verifier, redirectUri }, householdId),
        expiresAt: new Date(Date.now() + 600_000),
      },
    });
  });
  const url = new URL("https://oda.com/o/authorize/");
  url.search = new URLSearchParams({
    client_id: client.client_id,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "mcp",
    state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    resource: "https://oda.com/mcp",
  }).toString();
  return { url: url.href };
}

export async function callback(
  db: PrismaClient,
  householdId: string,
  userId: string,
  input: { state: string; code: string },
) {
  await db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Household" WHERE id = ${householdId} FOR UPDATE`;
      const authorization = await tx.odaAuthorization.findFirst({
        where: {
          state: input.state,
          householdId,
          userId,
          expiresAt: { gt: new Date() },
        },
      });
      if (!authorization)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Oda login expired. Connect again.",
        });
      const client = authorizationSchema.parse(
        decrypt(authorization.credentials, householdId),
      );
      const result = await token({
        grant_type: "authorization_code",
        code: input.code,
        code_verifier: client.verifier,
        redirect_uri: client.redirectUri,
        client_id: client.client_id,
        ...(client.client_secret
          ? { client_secret: client.client_secret }
          : {}),
      });
      const membership = await tx.membership.findUnique({ where: { userId } });
      if (membership?.householdId !== householdId)
        throw new TRPCError({ code: "FORBIDDEN" });
      const credentials = encrypt(
        {
          client_id: client.client_id,
          client_secret: client.client_secret,
          accessToken: result.access_token,
          refreshToken: result.refresh_token,
          expiresAt: Date.now() + result.expires_in * 1000,
        },
        householdId,
      );
      await tx.odaConnection.upsert({
        where: { householdId },
        create: { householdId, credentials },
        update: {
          credentials,
          reconnectRequired: false,
          revision: crypto.randomUUID(),
        },
      });
      await tx.odaAuthorization.delete({ where: { state: input.state } });
    },
    { timeout: 25_000 },
  );
}

export async function accessToken(db: PrismaClient, householdId: string) {
  const result = await db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Household" WHERE id = ${householdId} FOR UPDATE`;
      const connection = await tx.odaConnection.findUnique({
        where: { householdId },
      });
      if (!connection || connection.reconnectRequired) return null;
      const credentials = credentialsSchema.parse(
        decrypt(connection.credentials, householdId),
      );
      if (credentials.expiresAt > Date.now() + 60_000)
        return {
          token: credentials.accessToken,
          revision: connection.revision,
        };
      try {
        if (!credentials.refreshToken) throw reconnect();
        const refreshed = await token({
          grant_type: "refresh_token",
          refresh_token: credentials.refreshToken,
          client_id: credentials.client_id,
          ...(credentials.client_secret
            ? { client_secret: credentials.client_secret }
            : {}),
        });
        await tx.odaConnection.update({
          where: { householdId },
          data: {
            credentials: encrypt(
              {
                ...credentials,
                accessToken: refreshed.access_token,
                refreshToken:
                  refreshed.refresh_token ?? credentials.refreshToken,
                expiresAt: Date.now() + refreshed.expires_in * 1000,
              },
              householdId,
            ),
          },
        });
        return { token: refreshed.access_token, revision: connection.revision };
      } catch {
        await tx.odaConnection.update({
          where: { householdId },
          data: { reconnectRequired: true },
        });
        return null;
      }
    },
    { timeout: 25_000 },
  );
  if (!result) throw reconnect();
  return result;
}

export async function disconnect(db: PrismaClient, householdId: string) {
  const connection = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Household" WHERE id = ${householdId} FOR UPDATE`;
    const previous = await tx.odaConnection.findUnique({
      where: { householdId },
    });
    await tx.odaAuthorization.deleteMany({ where: { householdId } });
    await tx.odaConnection.deleteMany({ where: { householdId } });
    return previous;
  });
  if (!connection) return;
  try {
    const credentials = credentialsSchema.parse(
      decrypt(connection.credentials, householdId),
    );
    for (const value of [
      credentials.refreshToken,
      credentials.accessToken,
    ].filter((value): value is string => !!value)) {
      await fetch("https://oda.com/o/revoke_token/", {
        method: "POST",
        body: new URLSearchParams({
          token: value,
          client_id: credentials.client_id,
          ...(credentials.client_secret
            ? { client_secret: credentials.client_secret }
            : {}),
        }),
        signal: AbortSignal.timeout(10_000),
      });
    }
  } catch {
    /* Local access is removed even when Oda is unavailable. */
  }
}
