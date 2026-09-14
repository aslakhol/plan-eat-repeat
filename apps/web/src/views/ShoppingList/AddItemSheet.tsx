import { useEffect, useRef, useState } from "react";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalTitle,
} from "~/components/ResponsiveModal";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { api } from "~/utils/api";
import { DinnerSourceActions } from "./DinnerSourceActions";
import { type ShoppingDinnerSource } from "./DinnerPicker";

export function AddItemSheet({
  open,
  onOpenChange,
  onSelectDinners,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectDinners: (source: ShoppingDinnerSource) => void;
}) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const utils = api.useUtils();
  const add = api.shoppingList.addManual.useMutation({
    networkMode: "always",
    retry: false,
    onSuccess: () => {
      setName("");
      inputRef.current?.focus();
      void utils.shoppingList.invalidate();
    },
  });

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 100);
    return () => window.clearTimeout(timer);
  }, [open]);

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent className="h-auto rounded-t-3xl bg-white p-5 pb-8 md:rounded-2xl md:pt-10">
        <ResponsiveModalTitle className="sr-only">
          Add an item
        </ResponsiveModalTitle>
        <ResponsiveModalDescription className="sr-only">
          Add to your shopping list
        </ResponsiveModalDescription>
        <form
          className="flex gap-2.5"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim() && !add.isPending) add.mutate({ name });
          }}
        >
          <label htmlFor="shopping-item-name" className="sr-only">
            Item name
          </label>
          <Input
            id="shopping-item-name"
            ref={inputRef}
            autoFocus
            autoComplete="off"
            placeholder="Add an item"
            className="h-[50px] min-w-0 rounded-xl bg-white text-base"
            value={name}
            readOnly={add.isPending}
            onChange={(event) => setName(event.target.value)}
          />
          <Button
            type="submit"
            className="h-[50px] rounded-xl px-6"
            disabled={!name.trim() || add.isPending}
            onMouseDown={(event) => event.preventDefault()}
          >
            {add.isPending ? "Adding…" : "Add"}
          </Button>
        </form>
        {add.isError && (
          <p role="alert" className="text-destructive mt-3 text-sm">
            Could not add the item. Check your connection and try again.
          </p>
        )}
        <div className="mt-4 border-t pt-4">
          <DinnerSourceActions onSelect={onSelectDinners} />
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
