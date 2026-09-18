import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/router";
import {
  ResponsiveModal,
  ResponsiveModalTrigger,
} from "~/components/ResponsiveModal";

import { api } from "~/utils/api";
import { localCalendarBoundaries } from "~/hooks/use-dinner-summaries";
import { shoppingChoicesQueryOptions } from "~/lib/query-freshness";

const ShoppingItemCreationContext = createContext<{
  close: () => void;
  rememberTrigger: (element: HTMLButtonElement) => void;
  restoreFocus: (event: Event) => void;
} | null>(null);

export function ShoppingItemCreationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const { pathname } = useRouter();

  if (pathname !== "/shopping-list" && open) setOpen(false);

  const utils = api.useUtils();
  const onOpenChange = (nextOpen: boolean) => {
    // Dismiss the keyboard before the focused input animates offscreen.
    if (!nextOpen && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    if (nextOpen) {
      const calendar = localCalendarBoundaries();
      void utils.dinner.summaries.prefetch(
        calendar,
        shoppingChoicesQueryOptions,
      );
      void utils.plan.plannedDinners.prefetch(
        { startOfWeek: calendar.currentWeekStart },
        shoppingChoicesQueryOptions,
      );
    }
    setOpen(nextOpen);
  };

  return (
    <ShoppingItemCreationContext.Provider
      value={{
        close: () => onOpenChange(false),
        rememberTrigger: (element) => {
          trigger.current = element;
        },
        restoreFocus: (event) => {
          // Radix has one trigger ref; this drawer has page and navigation triggers.
          if (trigger.current?.isConnected) {
            event.preventDefault();
            trigger.current.focus({ preventScroll: true });
          }
        },
      }}
    >
      <ResponsiveModal open={open} onOpenChange={onOpenChange} repositionInputs>
        {children}
      </ResponsiveModal>
    </ShoppingItemCreationContext.Provider>
  );
}

export function ShoppingItemCreationTrigger({
  children,
}: {
  children: ReactNode;
}) {
  const { rememberTrigger } = useShoppingItemCreation();
  return (
    <ResponsiveModalTrigger
      asChild
      onClick={(event) => rememberTrigger(event.currentTarget)}
    >
      {children}
    </ResponsiveModalTrigger>
  );
}

export function useShoppingItemCreation() {
  const context = useContext(ShoppingItemCreationContext);
  if (!context) throw new Error("ShoppingItemCreationContext is missing");
  return context;
}
