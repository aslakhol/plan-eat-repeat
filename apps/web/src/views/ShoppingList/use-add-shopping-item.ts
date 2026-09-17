import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "~/components/ui/use-toast";
import { type suggestShoppingItems } from "~/lib/shopping-matching";
import { api } from "~/utils/api";

export type ShoppingPreview = ReturnType<typeof suggestShoppingItems>[number];

export function useAddShoppingItem() {
  const utils = api.useUtils();
  const [pendingItems, setPendingItems] = useState<
    Array<ShoppingPreview & { id: string }>
  >([]);
  const add = useMutation({
    networkMode: "always",
    retry: false,
    meta: { handlesError: true },
    mutationFn: (preview: ShoppingPreview) =>
      utils.client.shoppingList.addSelection.mutate(preview.selection),
    onMutate: (preview) => {
      const id = crypto.randomUUID();
      setPendingItems((items) => [...items, { ...preview, id }]);
      return { id };
    },
    onSuccess: async (saved) => {
      void utils.oda.transfer.invalidate();
      // An older poll must not replace the saved result after it arrives.
      await utils.shoppingList.list.cancel();
      utils.shoppingList.list.setData(undefined, (items) => [
        ...(items ?? []).filter((item) => item.id !== saved.id),
        saved,
      ]);
    },
    onError: (_error, preview) => {
      toast({
        variant: "destructive",
        title: `Could not add ${preview.name}`,
        description: "Check your connection and try again.",
      });
    },
    onSettled: (_saved, _error, _preview, context) => {
      setPendingItems((items) =>
        items.filter((item) => item.id !== context?.id),
      );
      void utils.shoppingList.invalidate();
    },
  });
  return { addItem: add.mutate, pendingItems };
}
