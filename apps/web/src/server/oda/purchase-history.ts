import { z } from "zod";
import type { PrismaClient } from "@planeatrepeat/db";
import { odaTool, productSchema } from "./provider";

const suggestionsSchema = z.object({ result: z.array(productSchema) });
const ordersSchema = z.object({
  orders: z.array(
    z.object({ products: z.array(z.object({ product: productSchema })) }),
  ),
});

export async function purchaseHistory(db: PrismaClient, householdId: string) {
  try {
    const suggestions = suggestionsSchema.parse(
      await odaTool(db, householdId, "likely_to_buy"),
    );
    const available = suggestions.result
      .filter((product) => product.availability?.isAvailable)
      .slice(0, 20);
    if (available.length) return available;
  } catch {
    /* Recommendations are optional; try recent orders instead. */
  }
  try {
    const orders = ordersSchema.parse(
      await odaTool(db, householdId, "get_orders", { page: 1, size: 3 }),
    );
    return [
      ...new Map(
        orders.orders
          .slice(0, 3)
          .flatMap((order) => order.products)
          .map(({ product }) => [product.id, product]),
      ).values(),
    ].slice(0, 30);
  } catch {
    return [];
  }
}
