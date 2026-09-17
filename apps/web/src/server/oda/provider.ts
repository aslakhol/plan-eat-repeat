import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@planeatrepeat/db";
import { accessToken } from "./connection";

export const productSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  description: z.string(),
  price: z.string(),
  unitName: z.string(),
  unitPrice: z.string(),
  brand: z.string().nullish(),
  availability: z.object({ isAvailable: z.boolean() }).nullish(),
});
export const cartSchema = z.object({
  url: z
    .string()
    .url()
    .refine((value) => new URL(value).origin === "https://oda.com"),
  groups: z.array(
    z.object({
      items: z.array(
        z.object({
          product: productSchema,
          quantity: z.number().int().nonnegative(),
        }),
      ),
    }),
  ),
});
export type Cart = z.infer<typeof cartSchema>;

export async function odaTool(
  db: PrismaClient,
  householdId: string,
  name:
    | "get_cart"
    | "product_search"
    | "manipulate_cart"
    | "likely_to_buy"
    | "get_orders",
  args: Record<string, unknown> = {},
) {
  const credentials = await accessToken(db, householdId);
  const client = new Client({ name: "plan-eat-repeat", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(
    new URL("https://oda.com/mcp"),
    {
      requestInit: {
        headers: { Authorization: `Bearer ${credentials.token}` },
      },
    },
  );
  try {
    await client.connect(transport, { timeout: 20_000 });
    const result = await client.callTool({ name, arguments: args }, undefined, {
      timeout: 30_000,
    });
    if (result.isError) throw new Error("Oda tool failed");
    if (result.structuredContent) return result.structuredContent;
    const content = z
      .array(z.object({ type: z.string(), text: z.string().optional() }))
      .parse(result.content);
    const text = content.find((item) => item.type === "text")?.text;
    if (!text) throw new Error("Missing Oda response");
    return JSON.parse(text) as unknown;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === 401) {
      await db.odaConnection.updateMany({
        where: { householdId, revision: credentials.revision },
        data: { reconnectRequired: true },
      });
    }
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message:
        "Could not reach Oda. Check the connection in Shopping List settings.",
    });
  } finally {
    await client.close().catch(() => undefined);
  }
}
