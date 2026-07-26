import { createNextApiHandler } from "@trpc/server/adapters/next";
import { type NextApiRequest, type NextApiResponse } from "next";

import { env } from "~/env";
import { appRouter } from "~/server/api/root";
import { createTRPCContext } from "~/server/api/trpc";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "4.5mb",
    },
  },
  maxDuration: 60,
};

// Create the tRPC handler
const handler = createNextApiHandler({
  router: appRouter,
  createContext: createTRPCContext,
  onError:
    env.NODE_ENV === "development"
      ? ({ path, error }) => {
          console.error(
            `❌ tRPC failed on ${path ?? "<no-path>"}: ${error.message}`,
          );
        }
      : undefined,
});

// Wrap with CORS headers for mobile app development
export default function corsHandler(req: NextApiRequest, res: NextApiResponse) {
  // Set CORS headers for development
  if (env.NODE_ENV === "development") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization",
    );
  }

  // Handle preflight
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  return handler(req, res);
}
