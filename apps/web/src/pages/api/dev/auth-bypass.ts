import type { NextApiRequest, NextApiResponse } from "next";
import { clerkClient } from "@clerk/nextjs/server";

const DEV_BYPASS_EMAIL = "aslakhol@gmail.com";
const SIGN_IN_TOKEN_TTL_SECONDS = 60;

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
  res: NextApiResponse<{ ticket?: string; error?: string }>,
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
    const users = await client.users.getUserList({
      emailAddress: [DEV_BYPASS_EMAIL],
      limit: 1,
    });

    const devUser = users.data[0];
    if (!devUser) {
      return res.status(404).json({ error: "Dev bypass user not found" });
    }

    const signInToken = await client.signInTokens.createSignInToken({
      userId: devUser.id,
      expiresInSeconds: SIGN_IN_TOKEN_TTL_SECONDS,
    });

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ticket: signInToken.token });
  } catch (err) {
    console.error("Failed to create local dev auth bypass token", err);
    return res.status(500).json({ error: "Failed to create bypass token" });
  }
}
