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
import { AddItemSheet } from "./AddItemSheet";
import { DinnerPicker, type ShoppingDinnerSource } from "./DinnerPicker";
import { ShoppingReady, useShopping } from "./ShoppingProvider";

const ShoppingItemCreationContext = createContext<{
  close: () => void;
  openDinnerPicker: (source: ShoppingDinnerSource) => void;
  rememberTrigger: (element: HTMLButtonElement) => void;
  restoreFocus: (event: Event) => void;
} | null>(null);

export function ShoppingItemCreationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pickerSource, setPickerSource] = useState<ShoppingDinnerSource | null>(
    null,
  );
  const trigger = useRef<HTMLButtonElement | null>(null);
  const { pathname } = useRouter();
  const [previousPathname, setPreviousPathname] = useState(pathname);
  const isShopping =
    pathname === "/shopping-list" || pathname === "/shopping-list/usually-have";

  if (previousPathname !== pathname) {
    setPreviousPathname(pathname);
    setOpen(false);
    setPickerSource(null);
  }

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
        openDinnerPicker: (source) => {
          onOpenChange(false);
          setPickerSource(source);
        },
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
        {isShopping && (
          <ShoppingReady>
            <ShoppingCreationDialogs
              pickerSource={pickerSource}
              closePicker={() => setPickerSource(null)}
            />
          </ShoppingReady>
        )}
      </ResponsiveModal>
    </ShoppingItemCreationContext.Provider>
  );
}

function ShoppingCreationDialogs({
  pickerSource,
  closePicker,
}: {
  pickerSource: ShoppingDinnerSource | null;
  closePicker: () => void;
}) {
  const { addItem } = useShopping();
  const { openDinnerPicker } = useShoppingItemCreation();
  return (
    <>
      <AddItemSheet onAdd={addItem} onSelectDinners={openDinnerPicker} />
      {pickerSource && (
        <DinnerPicker initialSource={pickerSource} onClose={closePicker} />
      )}
    </>
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
