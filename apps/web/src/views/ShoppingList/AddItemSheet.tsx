import { useState } from "react";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalScrollViewport,
  ResponsiveModalTitle,
} from "~/components/ResponsiveModal";
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
  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange} repositionInputs>
      {open && (
        <AddItemContent
          onAdded={() => onOpenChange(false)}
          onSelectDinners={onSelectDinners}
        />
      )}
    </ResponsiveModal>
  );
}

function AddItemContent({
  onAdded,
  onSelectDinners,
}: {
  onAdded: () => void;
  onSelectDinners: (source: ShoppingDinnerSource) => void;
}) {
  const [query, setQuery] = useState("");
  const [typing, setTyping] = useState(false);
  const utils = api.useUtils();
  const suggestions = api.shoppingList.suggest.useQuery(
    { query },
    { enabled: Boolean(query.trim()) },
  );
  const previews = query.trim() ? (suggestions.data ?? []) : [];
  const add = api.shoppingList.addSelection.useMutation({
    networkMode: "always",
    retry: false,
    onSuccess: () => {
      void utils.shoppingList.invalidate();
      onAdded();
    },
  });

  return (
    <ResponsiveModalContent
      onOpenAutoFocus={(event) => event.preventDefault()}
      className={`flex flex-col gap-0 rounded-t-3xl bg-white p-5 pb-8 md:rounded-2xl md:pt-10 ${typing ? "h-[65dvh] max-h-[600px]" : "h-auto"}`}
    >
      <ResponsiveModalTitle className="sr-only">
        Add an item
      </ResponsiveModalTitle>
      <ResponsiveModalDescription className="sr-only">
        Add to your shopping list
      </ResponsiveModalDescription>
      {typing && (
        <ResponsiveModalScrollViewport
          className="mb-3 flex-1"
          role="listbox"
          aria-label="Shopping suggestions"
        >
          {previews.map((preview, index) => (
            <button
              key={index}
              type="button"
              role="option"
              aria-selected={false}
              aria-label={
                preview.note ? `${preview.name}, ${preview.note}` : preview.name
              }
              className="hover:bg-accent focus-visible:bg-accent flex w-full flex-col rounded-lg px-3 py-3 text-left focus-visible:outline-none"
              disabled={add.isPending}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => add.mutate(preview.selection)}
            >
              <span className="font-medium">{preview.name}</span>
              {preview.note && (
                <span className="text-muted-foreground text-sm">
                  {preview.note}
                </span>
              )}
            </button>
          ))}
        </ResponsiveModalScrollViewport>
      )}
      <form
        className="shrink-0"
        onSubmit={(event) => {
          event.preventDefault();
          if (query.trim() && !add.isPending)
            add.mutate({ name: query, note: null });
        }}
      >
        <label htmlFor="shopping-item-name" className="sr-only">
          Item name
        </label>
        <Input
          id="shopping-item-name"
          autoComplete="off"
          enterKeyHint="done"
          placeholder="Add an item"
          className="h-[50px] min-w-0 rounded-xl bg-white text-base"
          value={query}
          readOnly={add.isPending}
          onFocus={() => setTyping(true)}
          onChange={(event) => setQuery(event.target.value)}
        />
      </form>
      {add.isError && (
        <p role="alert" className="text-destructive mt-3 shrink-0 text-sm">
          Could not add the item. Check your connection and try again.
        </p>
      )}
      {suggestions.isError && query.trim() && (
        <p role="alert" className="text-destructive mt-3 shrink-0 text-sm">
          Could not load suggestions. Try again.
        </p>
      )}
      {!typing && (
        <div className="mt-4 border-t pt-4">
          <DinnerSourceActions onSelect={onSelectDinners} />
        </div>
      )}
    </ResponsiveModalContent>
  );
}
