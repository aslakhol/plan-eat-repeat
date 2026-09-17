import type { NextApiRequest, NextApiResponse } from "next";
import { createTRPCContext } from "~/server/api/trpc";
import { odaRouter } from "~/server/api/routers/oda";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).end();
  const { state, code } = req.query;
  try {
    if (typeof state !== "string" || typeof code !== "string")
      throw new Error("Invalid callback");
    await odaRouter
      .createCaller(createTRPCContext({ req }))
      .callback({ state, code });
    return res.redirect(303, "/shopping-list?oda=connected");
  } catch {
    return res.redirect(303, "/shopping-list?oda=failed");
  }
}
