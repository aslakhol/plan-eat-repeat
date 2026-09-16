import { shoppingCategoryOrder } from "@planeatrepeat/shared";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "~/components/ui/use-toast";
import { api, type RouterOutputs } from "~/utils/api";

type ShoppingItem = RouterOutputs["shoppingList"]["list"][number];
type Move = { item: ShoppingItem; recent: boolean };
type PendingMove = {
  key: string;
  confirmed: Move;
  desiredRecent: boolean;
  ids: Set<string>;
};

export function useMoveShoppingItem(
  list: ShoppingItem[],
  recent: ShoppingItem[],
) {
  const utils = api.useUtils();
  const moves = useRef(new Map<string, PendingMove>());
  const [pending, setPending] = useState<PendingMove[]>([]);
  const publish = () =>
    setPending(
      [...moves.current.values()].map((move) => ({
        ...move,
        ids: new Set(move.ids),
      })),
    );
  const mutation = useMutation({
    networkMode: "always",
    retry: false,
    meta: { handlesError: true },
    mutationFn: async ({ item, recent }: Move) => {
      if (recent) {
        const saved = await utils.client.shoppingList.addRecent.mutate({
          id: item.id,
        });
        return { item: saved, recent: false as const };
      }
      const saved = await utils.client.shoppingList.remove.mutate({
        id: item.id,
      });
      if (!saved.recentItem)
        throw new Error("The item has already been removed");
      return { item: saved.recentItem, recent: true as const };
    },
  });

  const save = async (move: PendingMove) => {
    try {
      // A second tap changes the destination immediately. Save this item's
      // requests in order, using the real ID returned by the previous move.
      while (move.desiredRecent !== move.confirmed.recent) {
        const before = move.confirmed;
        const saved = await mutation.mutateAsync(before);
        move.confirmed = saved;
        move.ids.add(saved.item.id);
        await Promise.all([
          utils.shoppingList.list.cancel(),
          utils.shoppingList.recent.cancel(),
        ]);
        utils.shoppingList.list.setData(undefined, (items = []) =>
          saved.recent
            ? items.filter((item) => item.id !== before.item.id)
            : [
                ...items.filter((item) => item.id !== saved.item.id),
                saved.item,
              ],
        );
        utils.shoppingList.recent.setData(undefined, (items = []) => {
          const others = items.filter(
            (item) => item.ownItemId !== saved.item.ownItemId,
          );
          return saved.recent ? [saved.item, ...others].slice(0, 25) : others;
        });
        publish();
      }
    } catch {
      // An intervening tap may already have returned to the confirmed state.
      if (move.desiredRecent !== move.confirmed.recent) {
        toast({
          variant: "destructive",
          title: "Could not update shopping list",
          description: "Check your connection and try again.",
        });
      }
    } finally {
      moves.current.delete(move.key);
      publish();
      // Refresh in the background; another tap never waits for these queries.
      void utils.shoppingList.invalidate();
    }
  };

  const moveItem = ({ item, recent }: Move) => {
    const existing = moves.current.get(item.id);
    if (existing) {
      existing.desiredRecent = !recent;
      moves.current.delete(existing.key);
      moves.current.set(existing.key, existing);
      publish();
      return;
    }
    const move: PendingMove = {
      key: item.id,
      confirmed: { item, recent },
      desiredRecent: !recent,
      ids: new Set([item.id]),
    };
    moves.current.set(move.key, move);
    publish();
    void save(move);
  };

  // Keep each pending row's UI ID stable through repeated moves. Polls can
  // contain any of its previous server IDs, so hide those until it settles.
  const pendingOwnIds = new Set(
    pending.map(({ confirmed }) => confirmed.item.ownItemId),
  );
  const hiddenIds = new Set(pending.flatMap((move) => [...move.ids]));
  // A poll can see an added row before the add response supplies its new ID.
  const restoringOwnIds = new Set(
    pending
      .filter((move) => move.confirmed.recent)
      .map((move) => move.confirmed.item.ownItemId),
  );
  const items = [
    ...list.filter(
      (item) => !hiddenIds.has(item.id) && !restoringOwnIds.has(item.ownItemId),
    ),
    ...pending
      .filter((move) => !move.desiredRecent)
      .map((move) => ({ ...move.confirmed.item, id: move.key })),
  ];
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
      .filter((move) => move.desiredRecent)
      .reverse()
      .map((move) => ({ ...move.confirmed.item, id: move.key })),
    ...recent,
  ]
    .filter(
      (item, index, entries) =>
        !activeIds.has(item.ownItemId) &&
        entries.findIndex((other) => other.ownItemId === item.ownItemId) ===
          index,
    )
    .slice(0, 25);

  return { moveItem, items, recentItems, pendingOwnIds };
}
