import {
  type QueryClient,
  type QueryKey,
  hashKey,
} from "@tanstack/react-query";
import { shoppingCategoryOrder } from "@planeatrepeat/shared";
import superjson from "superjson";
import { z } from "zod";
import type { RouterOutputs } from "~/utils/api";

export const SAVED_READS_KEY = "plan-eat-repeat:saved-reads:v1";
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const MAX_SIZE = 300_000;

// Validate complete responses on restore. Changes to these contracts should
// also change the storage version. App status is deliberately not persisted:
// a saved read is useful content, not evidence for household setup or welcome.
const planData = z.object({
  plans: z.array(
    z.object({
      id: z.number(),
      date: z.date(),
      dinner: z.object({ id: z.number(), name: z.string() }),
    }),
  ),
  appStatus: z.null(),
}) satisfies z.ZodType<
  Omit<RouterOutputs["plan"]["weekOverview"], "appStatus">
>;

const shoppingItem = z.object({
  id: z.string(),
  ownItemId: z.string(),
  householdId: z.string(),
  amount: z.number().nullable(),
  unit: z.string().nullable(),
  revision: z.string(),
  name: z.string(),
  normalizedName: z.string(),
  note: z.string().nullable(),
  ownItem: z.object({
    id: z.string(),
    householdId: z.string(),
    name: z.string(),
    normalizedName: z.string(),
    note: z.string().nullable(),
    normalizedNote: z.string(),
    category: z.enum(["PRODUCE", ...shoppingCategoryOrder]),
    usuallyHave: z.boolean(),
    odaProductId: z.number().nullable(),
    odaProductName: z.string().nullable(),
    odaProductDescription: z.string().nullable(),
  }),
});
const listData = z.object({
  items: z.array(shoppingItem),
  shoppingLanguage: z.enum(["en", "no"]),
  appStatus: z.null(),
}) satisfies z.ZodType<
  Omit<RouterOutputs["shoppingList"]["list"], "appStatus">
>;
const recentData = z.object({
  items: z.array(shoppingItem.extend({ recentlyUsedAt: z.date() })),
  appStatus: z.null(),
}) satisfies z.ZodType<
  Omit<RouterOutputs["shoppingList"]["recent"], "appStatus">
>;

const snapshot = z.union([
  z.object({
    queryKey: z.tuple([
      z.tuple([z.literal("plan"), z.literal("weekOverview")]),
      z.object({
        input: z.object({ startOfWeek: z.date() }),
        type: z.literal("query"),
      }),
    ]),
    data: planData,
    confirmedAt: z.number().finite().positive(),
  }),
  z.object({
    queryKey: z.tuple([
      z.tuple([z.literal("shoppingList"), z.literal("list")]),
      z.object({ type: z.literal("query") }),
    ]),
    data: listData,
    confirmedAt: z.number().finite().positive(),
  }),
  z.object({
    queryKey: z.tuple([
      z.tuple([z.literal("shoppingList"), z.literal("recent")]),
      z.object({ type: z.literal("query") }),
    ]),
    data: recentData,
    confirmedAt: z.number().finite().positive(),
  }),
]);
type Snapshot = z.infer<typeof snapshot>;
type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;

function read(storage: Storage): Snapshot[] {
  const raw = storage.getItem(SAVED_READS_KEY);
  if (!raw || raw.length > MAX_SIZE) return [];
  const entries = z.array(z.unknown()).parse(superjson.parse<unknown>(raw));
  return entries.flatMap((entry) => {
    const parsed = snapshot.safeParse(entry);
    return parsed.success && Date.now() - parsed.data.confirmedAt <= MAX_AGE
      ? [parsed.data]
      : [];
  });
}

// Called only from QueryCache.onSuccess, never from cache updates or rendered
// shopping overlays. Acknowledged writes are saved by their subsequent read.
export function saveConfirmedRead(
  storage: Storage,
  queryKey: QueryKey,
  data: unknown,
) {
  try {
    const response = z.object({}).passthrough().parse(data);
    const entry = snapshot.safeParse({
      queryKey,
      data: { ...response, appStatus: null },
      confirmedAt: Date.now(),
    });
    if (!entry.success) return;
    let previous: Snapshot[] = [];
    try {
      previous = read(storage);
    } catch {
      // Replace corrupt snapshots after the next confirmed read.
    }
    const key = hashKey(queryKey);
    const others = previous.filter((saved) => hashKey(saved.queryKey) !== key);
    // Keep both shopping reads and up to five recently viewed/prefetched weeks.
    const weeks = others
      .filter((saved) => saved.queryKey[0][0] === "plan")
      .sort((a, b) => b.confirmedAt - a.confirmedAt)
      .slice(0, entry.data.queryKey[0][0] === "plan" ? 4 : 5);
    const shopping = others.filter(
      (saved) => saved.queryKey[0][0] === "shoppingList",
    );
    const serialized = superjson.stringify([...weeks, ...shopping, entry.data]);
    if (serialized.length <= MAX_SIZE)
      storage.setItem(SAVED_READS_KEY, serialized);
  } catch {
    // Storage access/quota failures must not turn a successful read into an error.
  }
}

export function restoreSavedReads(storage: Storage, client: QueryClient) {
  try {
    for (const { queryKey, data, confirmedAt } of read(storage)) {
      if (client.getQueryData(queryKey) !== undefined) continue;
      client.setQueryData(queryKey, data, { updatedAt: confirmedAt });
      // Even a snapshot from seconds ago needs a background refresh.
      void client.invalidateQueries({
        queryKey,
        exact: true,
        refetchType: "none",
      });
    }
  } catch {
    // Missing, incompatible, or unavailable storage falls back to normal reads.
  }
}
