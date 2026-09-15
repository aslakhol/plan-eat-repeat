import type { ShoppingCategory } from "@planeatrepeat/db";
import {
  capitalizeShoppingName,
  normalizeShoppingName,
} from "@planeatrepeat/shared";

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
        name: destination?.name ?? capitalizeShoppingName(source.name),
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
  const literal = capitalizeShoppingName(query);
  const key = shoppingIdentity(literal, null);
  if (!previews.has(key))
    previews.set(key, {
      name: literal,
      note: null,
      selection: { name: literal, note: null },
    });
  return [...previews.values()];
}

// Recipe names are complete input. Keep this decision independent of the
// interactive preview ordering: ambiguity must not silently choose a product.
export function selectRecipeIngredient(
  name: string,
  sources: readonly ShoppingSource[],
): ShoppingSelection {
  const literal = { name: name.trim(), note: null };
  const candidates = sources.flatMap((source) => {
    if (source.note) return [];
    const match = matchShoppingWords(name, source.name, "complete");
    if (!match.matched || match.introduced) return [];
    return [
      {
        source,
        note: match.unmatched.join(" ") || null,
        matched: match.matched,
      },
    ];
  });
  const exact = candidates.filter(
    ({ source }) =>
      normalizeShoppingName(source.name) === normalizeShoppingName(name),
  );
  let chosen = exact.find(({ source }) => source.id) ?? exact[0];
  if (!chosen) {
    const mostWords = Math.max(...candidates.map(({ matched }) => matched));
    const best = new Map<string, (typeof candidates)[number]>();
    for (const candidate of candidates) {
      if (candidate.matched !== mostWords) continue;
      const identity = shoppingIdentity(candidate.source.name, candidate.note);
      if (!best.has(identity) || candidate.source.id)
        best.set(identity, candidate);
    }
    if (best.size !== 1) return literal;
    chosen = best.values().next().value;
  }
  if (!chosen) return literal;
  const { source, note } = chosen;
  if (source.id && note === null) return { ownItemId: source.id };
  return {
    name: source.name,
    note,
    source: source.id
      ? { ownItemId: source.id }
      : { standardName: source.name },
  };
}
