import { matchQuery } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import type { PersistQueryClientProviderProps } from "@tanstack/react-query-persist-client";
import { getQueryKey } from "@trpc/react-query";
import superjson from "superjson";
import { api } from "~/utils/api";

export const SAVED_READS_KEY = "plan-eat-repeat:query-cache";

export function createPersistenceOptions(storage?: Storage) {
  const queryKeys = [
    getQueryKey(api.plan.weekOverview),
    getQueryKey(api.shoppingList.list),
    getQueryKey(api.shoppingList.recent),
  ];
  return {
    persister: createAsyncStoragePersister({
      storage,
      key: SAVED_READS_KEY,
      serialize: superjson.stringify,
      deserialize: superjson.parse,
    }),
    maxAge: 7 * 24 * 60 * 60 * 1000,
    buster: "v1",
    dehydrateOptions: {
      shouldDehydrateMutation: () => false,
      // Pending shopping edits live in React state. Cache updates come from
      // server responses, and remain useful even if a later refresh fails.
      shouldDehydrateQuery: (query) =>
        query.state.data !== undefined &&
        queryKeys.some((queryKey) => matchQuery({ queryKey }, query)),
    },
  } satisfies PersistQueryClientProviderProps["persistOptions"];
}
