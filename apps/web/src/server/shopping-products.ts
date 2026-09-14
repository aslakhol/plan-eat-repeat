import type { Prisma, ShoppingCategory } from "@planeatrepeat/db";
import { normalizeShoppingName } from "@planeatrepeat/shared";
import { shoppingCatalog } from "./shopping-catalog";

const catalog = new Map(
  shoppingCatalog.map(({ en, category }) => [
    normalizeShoppingName(en),
    category,
  ]),
);

export const rememberShoppingProduct = async (
  tx: Prisma.TransactionClient,
  householdId: string,
  name: string,
  initialCategory?: ShoppingCategory,
) => {
  const normalizedName = normalizeShoppingName(name);
  const existing = await tx.shoppingProduct.findUnique({
    where: { householdId_normalizedName: { householdId, normalizedName } },
  });
  if (existing) return existing;

  let category: ShoppingCategory | undefined =
    initialCategory ?? catalog.get(normalizedName);
  if (!category) {
    const remembered = await tx.shoppingProduct.findMany({
      where: { householdId },
      select: { normalizedName: true, category: true },
    });
    const candidates = new Map<string, ShoppingCategory>(catalog);
    for (const product of remembered) {
      candidates.set(product.normalizedName, product.category);
    }
    let longest = 0;
    let earliest = Infinity;
    for (const [phrase, candidate] of candidates) {
      if (candidate === "OWN_ITEMS") continue;
      const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const position = normalizedName.search(
        new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, "u"),
      );
      if (position < 0) continue;
      if (
        phrase.length > longest ||
        (phrase.length === longest && position < earliest)
      ) {
        category = candidate;
        longest = phrase.length;
        earliest = position;
      }
    }
  }
  return tx.shoppingProduct.create({
    data: {
      householdId,
      name: name.trim(),
      normalizedName,
      category: category ?? "OWN_ITEMS",
    },
  });
};

// Renames inherit the source only for a new name; a known destination keeps its
// own category unless the member explicitly selected a replacement.
export async function editShoppingProduct(
  tx: Prisma.TransactionClient,
  householdId: string,
  name: string,
  originalCategory: ShoppingCategory,
  selectedCategory?: ShoppingCategory,
) {
  const product = await rememberShoppingProduct(
    tx,
    householdId,
    name,
    selectedCategory ?? originalCategory,
  );
  if (selectedCategory === undefined) return product;
  return tx.shoppingProduct.update({
    where: { id: product.id, householdId },
    data: { category: selectedCategory },
  });
}
