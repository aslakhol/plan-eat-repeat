import { shoppingCategoryOrder } from "@planeatrepeat/shared";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "~/components/ui/use-toast";
import { api, type RouterOutputs } from "~/utils/api";

type ShoppingItem = RouterOutputs["shoppingList"]["list"][number];
type Move = { item: ShoppingItem; recent: boolean };

export function useMoveShoppingItem(
  list: ShoppingItem[],
  recent: ShoppingItem[],
) {
  const utils = api.useUtils();
  const [pending, setPending] = useState<Array<Move & { operationId: string }>>(
    [],
  );
  const finish = (operationId: string | undefined) =>
    setPending((moves) =>
      moves.filter((move) => move.operationId !== operationId),
    );
  const move = useMutation({
    networkMode: "always",
    retry: false,
    meta: { handlesError: true },
    mutationFn: async ({ item, recent }: Move) => {
      if (recent) {
        const saved = await utils.client.shoppingList.addRecent.mutate({
          id: item.id,
        });
        return { recent: true as const, saved };
      }
      const saved = await utils.client.shoppingList.remove.mutate({
        id: item.id,
      });
      return { recent: false as const, saved };
    },
    onMutate: (move) => {
      const operationId = crypto.randomUUID();
      setPending((moves) => [...moves, { ...move, operationId }]);
      return { operationId };
    },
    onSuccess: async (result, { item }) => {
      // Commit the server's IDs before enabling the item in its new list.
      await Promise.all([
        utils.shoppingList.list.cancel(),
        utils.shoppingList.recent.cancel(),
      ]);
      utils.shoppingList.list.setData(undefined, (items = []) =>
        result.recent
          ? [
              ...items.filter((entry) => entry.id !== result.saved.id),
              result.saved,
            ]
          : items.filter((entry) => entry.id !== item.id),
      );
      utils.shoppingList.recent.setData(undefined, (items = []) => {
        const others = items.filter(
          (entry) => entry.ownItemId !== item.ownItemId,
        );
        return !result.recent && result.saved.recentItem
          ? [result.saved.recentItem, ...others].slice(0, 25)
          : others;
      });
    },
    onError: (_error, _move, context) => {
      finish(context?.operationId);
      toast({
        variant: "destructive",
        title: "Could not update shopping list",
        description: "Check your connection and try again.",
      });
    },
    onSettled: async (_result, _error, _move, context) => {
      try {
        await utils.shoppingList.invalidate();
      } finally {
        finish(context?.operationId);
      }
    },
  });

  // Project pending moves over server data so polling and overlapping requests
  // cannot undo another item's optimistic update.
  const pendingOwnIds = new Set(pending.map(({ item }) => item.ownItemId));
  const removedIds = new Set(
    pending.filter((move) => !move.recent).map(({ item }) => item.id),
  );
  const items = list.filter((item) => !removedIds.has(item.id));
  for (const move of pending) {
    if (
      move.recent &&
      !items.some((item) => item.ownItemId === move.item.ownItemId)
    )
      items.push(move.item);
  }
  items.sort(
    (a, b) =>
      shoppingCategoryOrder.indexOf(a.ownItem.category) -
        shoppingCategoryOrder.indexOf(b.ownItem.category) ||
      a.normalizedName.localeCompare(b.normalizedName) ||
      a.ownItem.normalizedNote.localeCompare(b.ownItem.normalizedNote) ||
      a.id.localeCompare(b.id),
  );
  const activeIds = new Set(items.map((item) => item.ownItemId));
  const recentItems = [
    ...pending
      .filter((move) => !move.recent)
      .reverse()
      .map(({ item }) => item),
    ...recent,
  ]
    .filter(
      (item, index, entries) =>
        !activeIds.has(item.ownItemId) &&
        entries.findIndex((other) => other.ownItemId === item.ownItemId) ===
          index,
    )
    .slice(0, 25);

  return { moveItem: move.mutate, items, recentItems, pendingOwnIds };
}
