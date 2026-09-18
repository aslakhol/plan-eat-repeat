import { useShoppingDinnerAdditions } from "~/views/ShoppingList/ShoppingProvider";
import type { DinnerSelection } from "~/views/ShoppingList/use-add-dinners";

export const useAddDinnersToShoppingList = (
  onSubmitted?: () => void | Promise<void>,
) => {
  const shopping = useShoppingDinnerAdditions();
  return {
    isReady: !!shopping,
    add: (dinners: DinnerSelection[]) => {
      if (!shopping) return;
      shopping.addDinners(dinners);
      void onSubmitted?.();
    },
  };
};
