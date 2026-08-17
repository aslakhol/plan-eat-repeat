import type { NextApiRequest, NextApiResponse } from "next";
import { clerkClient } from "@clerk/nextjs/server";

const DEV_BYPASS_EMAIL = "aslakhol@gmail.com";
const SIGN_IN_TOKEN_TTL_SECONDS = 60;

const SAVE_INTENT_IDENTITIES = {
  "save-intent-existing": {
    email: "aslakhol+save-intent-existing@gmail.com",
    firstName: "Existing",
    lastName: "Visitor",
    recreate: false,
  },
  "save-intent-first-time": {
    email: "aslakhol+save-intent-first-time@gmail.com",
    firstName: "First",
    lastName: "Time",
    recreate: true,
  },
} as const;

type SaveIntentIdentity = keyof typeof SAVE_INTENT_IDENTITIES;

const isLocalHostname = (hostname: string) => {
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  ) {
    return true;
  }

  if (hostname.startsWith("192.168.") || hostname.startsWith("10.")) {
    return true;
  }

  const private172Range = /^172\.(1[6-9]|2\d|3[0-1])\./;
  return private172Range.test(hostname);
};

const getRequestHostname = (req: NextApiRequest) => {
  const rawHost = req.headers["x-forwarded-host"] ?? req.headers.host ?? "";
  const value = Array.isArray(rawHost) ? rawHost[0] : rawHost;
  const firstHost = (value ?? "").split(",")[0]?.trim() ?? "";
  return firstHost.split(":")[0] ?? "";
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ ticket?: string; userId?: string; error?: string }>,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (process.env.NODE_ENV !== "development") {
    return res.status(404).json({ error: "Not found" });
  }

  const hostname = getRequestHostname(req);
  if (!isLocalHostname(hostname)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const client = await clerkClient();
    const requestBody: unknown = req.body;
    const requestedIdentity =
      typeof requestBody === "object" &&
      requestBody !== null &&
      "identity" in requestBody &&
      typeof requestBody.identity === "string" &&
      requestBody.identity in SAVE_INTENT_IDENTITIES
        ? (requestBody.identity as SaveIntentIdentity)
        : null;
    const identity = requestedIdentity
      ? SAVE_INTENT_IDENTITIES[requestedIdentity]
      : null;
    const email = identity?.email ?? DEV_BYPASS_EMAIL;
    const users = await client.users.getUserList({
      emailAddress: [email],
      limit: 1,
    });

    let devUser = users.data[0];
    if (devUser && identity?.recreate) {
      await client.users.deleteUser(devUser.id);
      devUser = undefined;
    }
    if (!devUser && identity) {
      devUser = await client.users.createUser({
        emailAddress: [identity.email],
        firstName: identity.firstName ?? undefined,
        lastName: identity.lastName ?? undefined,
        skipPasswordRequirement: true,
      });
    }
    if (!devUser) {
      return res.status(404).json({ error: "Dev bypass user not found" });
    }

    const signInToken = await client.signInTokens.createSignInToken({
      userId: devUser.id,
      expiresInSeconds: SIGN_IN_TOKEN_TTL_SECONDS,
    });

    res.setHeader("Cache-Control", "no-store");
    return res
      .status(200)
      .json({ ticket: signInToken.token, userId: devUser.id });
  } catch (err) {
    console.error("Failed to create local dev auth bypass token", err);
    return res.status(500).json({ error: "Failed to create bypass token" });
  }
}
