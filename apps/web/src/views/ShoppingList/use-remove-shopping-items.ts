import { useState } from "react";
import { api, type RouterOutputs } from "~/utils/api";
import type { ShoppingWrites } from "./shopping-writes";
import type { ShoppingPreview } from "./use-add-shopping-item";

type Item = RouterOutputs["shoppingList"]["list"][number];
type Removal = {
  key: string;
  items: Item[];
  pendingAddIds: Set<string>;
  retryItems?: Pick<Item, "id" | "revision">[];
};

export function useRemoveShoppingItems(
  items: Item[],
  recentItems: Item[],
  pendingItems: Array<ShoppingPreview & { id: string }>,
  writes: ShoppingWrites,
  isCurrent: () => boolean,
) {
  const utils = api.useUtils();
  const [pendingRemovals, setPending] = useState<Removal[]>([]);
  const [failedRemovals, setFailed] = useState<Removal[]>([]);
  const dismissRemoval = (key: string) =>
    setFailed((failures) => failures.filter((failure) => failure.key !== key));
  const remove = (removal: Removal) => {
    const ticket = writes.reserve(true);
    setPending((pending) => [...pending, removal]);
    dismissRemoval(removal.key);
    const save = async () => {
      try {
        await ticket.ready;
        if (!isCurrent()) return;
        // Cache writes from predecessors have settled before this snapshot.
        const before = utils.shoppingList.list.getData() ?? [];
        const targets =
          removal.retryItems ??
          before.map(({ id, revision }) => ({ id, revision }));
        removal.retryItems = targets;
        const saved = await utils.client.shoppingList.clear.mutate({
          items: targets,
        });
        if (!isCurrent()) return;
        await Promise.all([
          utils.shoppingList.list.cancel(),
          utils.shoppingList.recent.cancel(),
        ]);
        if (!isCurrent()) return;
        const removedIds = new Set(saved.removedIds);
        utils.shoppingList.list.setData(undefined, (list = []) =>
          list.filter((item) => !removedIds.has(item.id)),
        );
        utils.shoppingList.recent.setData(undefined, saved.recentItems);
        void utils.oda.transfer.invalidate();
      } catch {
        if (isCurrent()) setFailed((failures) => [...failures, removal]);
      } finally {
        if (isCurrent()) {
          setPending((pending) =>
            pending.filter((entry) => entry.key !== removal.key),
          );
          void utils.shoppingList.list.invalidate();
          void utils.shoppingList.recent.invalidate();
        }
        ticket.release();
      }
    };
    void save();
  };
  const clearItems = () =>
    remove({
      key: crypto.randomUUID(),
      items,
      pendingAddIds: new Set(pendingItems.map((item) => item.id)),
    });
  const hidden = new Set(
    pendingRemovals.flatMap((removal) =>
      removal.retryItems
        ? items
            .filter((item) =>
              removal.retryItems!.some(
                (target) =>
                  target.id === item.id && target.revision === item.revision,
              ),
            )
            .map((item) => item.id)
        : items.map((item) => item.id),
    ),
  );
  const visibleItems = items.filter((item) => !hidden.has(item.id));
  const clearingItems = pendingRemovals.flatMap((removal) => removal.items);
  const activeOwnIds = new Set(visibleItems.map((item) => item.ownItemId));
  const visibleRecent = [...clearingItems, ...recentItems]
    .filter(
      (item, index, all) =>
        !activeOwnIds.has(item.ownItemId) &&
        all.findIndex((other) => other.ownItemId === item.ownItemId) === index,
    )
    .slice(0, 25);
  return {
    clearItems,
    pendingRemovals,
    failedRemovals,
    dismissRemoval,
    retryRemoval: remove,
    items: visibleItems,
    recentItems: visibleRecent,
    pendingItems: pendingItems.filter(
      (item) =>
        !pendingRemovals.some((removal) => removal.pendingAddIds.has(item.id)),
    ),
    removingOwnIds: new Set(
      [...clearingItems, ...items.filter((item) => hidden.has(item.id))].map(
        (item) => item.ownItemId,
      ),
    ),
  };
}
