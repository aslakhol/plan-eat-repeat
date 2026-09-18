import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "~/components/ui/use-toast";
import { type suggestShoppingItems } from "~/lib/shopping-matching";
import { api } from "~/utils/api";

export type ShoppingPreview = ReturnType<typeof suggestShoppingItems>[number];

import type { ShoppingWrites } from "./shopping-writes";

export function useAddShoppingItem(
  isCurrent: () => boolean,
  writes: ShoppingWrites,
) {
  const utils = api.useUtils();
  const [pendingItems, setPendingItems] = useState<
    Array<ShoppingPreview & { id: string }>
  >([]);
  const add = useMutation({
    networkMode: "always",
    retry: false,
    meta: { handlesError: true },
    mutationFn: async ({ preview, ticket }: Addition) => {
      await ticket.ready;
      if (!isCurrent()) throw new Error("Shopping session ended");
      return utils.client.shoppingList.addSelection.mutate(preview.selection);
    },
    onSuccess: async (saved) => {
      if (!isCurrent()) return;
      void utils.oda.transfer.invalidate();
      // An older poll must not replace the saved result after it arrives.
      await utils.shoppingList.list.cancel();
      if (!isCurrent()) return;
      utils.shoppingList.list.setData(undefined, (items) => [
        ...(items ?? []).filter((item) => item.id !== saved.id),
        saved,
      ]);
    },
    onError: (_error, { preview }) => {
      if (!isCurrent()) return;
      toast({
        variant: "destructive",
        title: `Could not add ${preview.name}`,
        description: "Check your connection and try again.",
      });
    },
    onSettled: (_saved, _error, { preview, id, ticket }) => {
      ticket.release();
      if (!isCurrent()) return;
      setPendingItems((items) => items.filter((item) => item.id !== id));
      void utils.shoppingList.list.invalidate();
      void utils.shoppingList.recent.invalidate();
      if (!("ownItemId" in preview.selection)) {
        void utils.shoppingList.sources.invalidate();
      }
    },
  });
  type Addition = {
    preview: ShoppingPreview;
    id: string;
    ticket: ReturnType<ShoppingWrites["reserve"]>;
  };
  const addItem = (preview: ShoppingPreview) => {
    const id = crypto.randomUUID();
    const ticket = writes.reserve();
    setPendingItems((items) => [...items, { ...preview, id }]);
    add.mutate({ preview, id, ticket });
  };
  return { addItem, pendingItems };
}
