import { ToastAction } from "~/components/ui/toast";
import { toast } from "~/components/ui/use-toast";
import { useShoppingWrite } from "~/views/ShoppingList/ShoppingProvider";
import { api } from "~/utils/api";

export const useAddDinnersToShoppingList = (
  onAdded?: () => void | Promise<void>,
) => {
  const utils = api.useUtils();
  const reserve = useShoppingWrite();
  const beforeWrite = async () => {
    const ticket = reserve();
    await ticket.ready;
    return ticket;
  };
  const undo = api.shoppingList.undo.useMutation({
    networkMode: "always",
    retry: false,
    onMutate: beforeWrite,
    onSettled: (_result, _error, _input, ticket) => ticket?.release(),
    onSuccess: () =>
      Promise.all([
        utils.shoppingList.list.invalidate(),
        utils.shoppingList.recent.invalidate(),
        utils.shoppingList.sources.invalidate(),
      ]),
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Could not undo shopping addition",
        description: error.message,
      });
    },
  });

  return api.shoppingList.addDinners.useMutation({
    networkMode: "always",
    retry: false,
    onMutate: beforeWrite,
    onSettled: (_result, _error, _input, ticket) => ticket?.release(),
    onSuccess: async (result) => {
      void utils.oda.transfer.invalidate();
      // Close the Dinner or picker drawer so Undo is outside its focus trap.
      await onAdded?.();
      // Clear/Delete wait for this addition's canonical rows. The shared
      // Dinner-add flow will replace this read with its mutation result.
      await Promise.all([
        utils.shoppingList.list.fetch(),
        utils.shoppingList.recent.invalidate(),
        utils.shoppingList.sources.invalidate(),
      ]);
      toast({
        title: "Added to shopping list",
        action: (
          <ToastAction
            altText="Undo adding to the shopping list"
            onClick={() => undo.mutate(result.undo)}
          >
            Undo
          </ToastAction>
        ),
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Could not add to shopping list",
        description: error.message,
      });
    },
  });
};
