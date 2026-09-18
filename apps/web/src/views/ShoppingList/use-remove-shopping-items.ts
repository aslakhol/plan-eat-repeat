import { shoppingIdentity } from "~/lib/shopping-matching";
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
} & ({ kind: "clear" } | { kind: "delete"; item: Item });

export function useRemoveShoppingItems(
  items: Item[],
  recentItems: Item[],
  pendingItems: Array<ShoppingPreview & { id: string }>,
  writes: ShoppingWrites,
  isCurrent: () => boolean,
  resolveOwnId: (id: string) => string,
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
        if (removal.kind === "delete") {
          const id = resolveOwnId(removal.item.ownItemId);
          await utils.client.shoppingList.deleteOwnItem.mutate({ id });
          if (!isCurrent()) return;
          await Promise.all([
            utils.shoppingList.list.cancel(),
            utils.shoppingList.recent.cancel(),
            utils.shoppingList.sources.cancel(),
            utils.shoppingList.usuallyHave.cancel(),
          ]);
          if (!isCurrent()) return;
          writes.forget(id);
          writes.forget(removal.item.ownItemId);
          utils.shoppingList.list.setData(undefined, (list) =>
            list?.filter((item) => item.ownItemId !== id),
          );
          utils.shoppingList.recent.setData(undefined, (recent) =>
            recent?.filter((item) => item.ownItemId !== id),
          );
          utils.shoppingList.sources.setData(undefined, (sources) =>
            sources?.filter((item) => item.id !== id),
          );
          utils.shoppingList.usuallyHave.setData(undefined, (ownItems) =>
            ownItems?.filter((item) => item.id !== id),
          );
          void utils.shoppingList.sources.invalidate();
          void utils.shoppingList.usuallyHave.invalidate();
        } else {
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
        }
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
      kind: "clear",
      items,
      pendingAddIds: new Set(pendingItems.map((item) => item.id)),
    });
  const deleteOwnItem = (item: Item) => {
    const id = resolveOwnId(item.ownItemId);
    const affected = (entry: Item) => resolveOwnId(entry.ownItemId) === id;
    remove({
      key: crypto.randomUUID(),
      kind: "delete",
      item,
      items: [...items, ...recentItems].filter(affected),
      pendingAddIds: new Set(
        pendingItems
          .filter(
            (pending) =>
              shoppingIdentity(pending.name, pending.note) ===
              shoppingIdentity(item.name, item.note),
          )
          .map((pending) => pending.id),
      ),
    });
  };
  const deleting = (item: Item) =>
    pendingRemovals.some(
      (removal) =>
        removal.kind === "delete" &&
        (resolveOwnId(removal.item.ownItemId) ===
          resolveOwnId(item.ownItemId) ||
          shoppingIdentity(removal.item.name, removal.item.note) ===
            shoppingIdentity(item.name, item.note)),
    );
  const clearing = (item: Item) =>
    pendingRemovals.some(
      (removal) =>
        removal.kind === "clear" &&
        (!removal.retryItems ||
          removal.retryItems.some(
            (target) =>
              target.id === item.id && target.revision === item.revision,
          )),
    );
  const visibleItems = items.filter(
    (item) => !deleting(item) && !clearing(item),
  );
  const clearingItems = pendingRemovals.flatMap((removal) =>
    removal.kind === "clear" ? removal.items : [],
  );
  const activeOwnIds = new Set(visibleItems.map((item) => item.ownItemId));
  const visibleRecent = [...clearingItems, ...recentItems]
    .filter(
      (item, index, all) =>
        !deleting(item) &&
        !activeOwnIds.has(item.ownItemId) &&
        all.findIndex((other) => other.ownItemId === item.ownItemId) === index,
    )
    .slice(0, 25);
  return {
    clearItems,
    deleteOwnItem,
    isDeletingOwnItem: (id: string) =>
      pendingRemovals.some(
        (removal) =>
          removal.kind === "delete" &&
          resolveOwnId(removal.item.ownItemId) === resolveOwnId(id),
      ),
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
      [...clearingItems, ...items.filter(clearing)].map(
        (item) => item.ownItemId,
      ),
    ),
  };
}
