import { ToastAction } from "~/components/ui/toast";
import { toast } from "~/components/ui/use-toast";
import { api } from "~/utils/api";

export const useAddDinnersToShoppingList = (
  onAdded?: () => void | Promise<void>,
) => {
  const utils = api.useUtils();
  const undo = api.shoppingList.undo.useMutation({
    networkMode: "always",
    retry: false,
    onSuccess: () => void utils.shoppingList.invalidate(),
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
    onSuccess: async (result) => {
      void utils.oda.transfer.invalidate();
      // Close the Dinner or picker drawer so Undo is outside its focus trap.
      await onAdded?.();
      void utils.shoppingList.invalidate();
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
