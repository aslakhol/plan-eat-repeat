import { createContext, useContext } from "react";

export const ShoppingItemCreationContext = createContext<{
  addOpen: boolean;
  setAddOpen: (open: boolean) => void;
} | null>(null);

export function useShoppingItemCreation() {
  const context = useContext(ShoppingItemCreationContext);
  if (!context) throw new Error("ShoppingItemCreationContext is missing");
  return context;
}
