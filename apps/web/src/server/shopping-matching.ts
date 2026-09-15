import type { ShoppingCategory } from "@planeatrepeat/db";
import { normalizeShoppingName } from "@planeatrepeat/shared";

export type ShoppingSource = {
  id?: string;
  name: string;
  note: string | null;
  category: ShoppingCategory;
};

export type ShoppingSelection =
  | { ownItemId: string }
  | {
      name: string;
      note: string | null;
      source?: { ownItemId: string } | { standardName: string };
    };

export const shoppingIdentity = (name: string, note: string | null) =>
  JSON.stringify([
    normalizeShoppingName(name),
    normalizeShoppingName(note ?? ""),
  ]);

// Complete input disables prefix completion. Recipe selection can use the same
// word rules without inheriting the interactive ranking or introducing words.
export function matchShoppingWords(
  query: string,
  name: string,
  mode: "interactive" | "complete",
) {
  const input = query.trim().split(/\s+/).filter(Boolean);
  const product = normalizeShoppingName(name).split(" ");
  const used = new Set<number>();
  const unmatched: string[] = [];
  let prefix = false;
  for (const [index, word] of input.entries()) {
    const normalized = word.toLowerCase();
    let match = product.findIndex(
      (part, i) => !used.has(i) && part === normalized,
    );
    if (
      match < 0 &&
      mode === "interactive" &&
      index === input.length - 1 &&
      !/\s$/.test(query)
    ) {
      match = product.findIndex(
        (part, i) => !used.has(i) && part.startsWith(normalized),
      );
      if (match >= 0) prefix = true;
    }
    if (match < 0) unmatched.push(word);
    else used.add(match);
  }
  return {
    matched: used.size,
    introduced: product.length - used.size,
    unmatched,
    prefix,
  };
}

export function suggestShoppingItems(
  query: string,
  sources: readonly ShoppingSource[],
) {
  if (!query.trim()) return [];
  const ownItems = new Map(
    sources
      .filter((source) => source.id)
      .map((source) => [shoppingIdentity(source.name, source.note), source]),
  );
  const matches = sources.flatMap((source) => {
    const match = matchShoppingWords(query, source.name, "interactive");
    if (!match.matched || (source.note && match.unmatched.length)) return [];
    const note = source.note ?? (match.unmatched.join(" ") || null);
    const destination = ownItems.get(shoppingIdentity(source.name, note));
    const selection: ShoppingSelection = destination?.id
      ? { ownItemId: destination.id }
      : {
          name: source.name,
          note,
          source: source.id
            ? { ownItemId: source.id }
            : { standardName: source.name },
        };
    const exact =
      normalizeShoppingName(query) === normalizeShoppingName(source.name);
    return [
      {
        name: destination?.name ?? source.name,
        note: destination?.note ?? note,
        selection,
        group: exact ? (note ? 1 : 0) : match.prefix ? 3 : 2,
        matched: match.matched,
        introduced: match.introduced,
        own: Boolean(source.id),
      },
    ];
  });
  matches.sort(
    (a, b) =>
      a.group - b.group ||
      b.matched - a.matched ||
      a.introduced - b.introduced ||
      Number(b.own) - Number(a.own) ||
      a.name.localeCompare(b.name) ||
      (a.note ?? "").localeCompare(b.note ?? ""),
  );
  const previews = new Map<
    string,
    { name: string; note: string | null; selection: ShoppingSelection }
  >();
  for (const { name, note, selection } of matches) {
    const key = shoppingIdentity(name, note);
    if (!previews.has(key)) previews.set(key, { name, note, selection });
  }
  const literal = query.trim();
  const key = shoppingIdentity(literal, null);
  if (!previews.has(key))
    previews.set(key, {
      name: literal,
      note: null,
      selection: { name: literal, note: null },
    });
  return [...previews.values()];
}
