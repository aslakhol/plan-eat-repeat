import { useRef, useState } from "react";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalScrollViewport,
  ResponsiveModalTitle,
} from "~/components/ResponsiveModal";
import { Input } from "~/components/ui/input";
import { suggestShoppingItems } from "~/lib/shopping-matching";
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
      <ResponsiveModalContent
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="flex h-auto flex-col gap-0 rounded-t-3xl bg-white p-5 pb-8 has-[[data-typing=true]]:h-[65dvh] has-[[data-typing=true]]:max-h-[600px] md:rounded-2xl md:pt-10"
      >
        <AddItemContent
          onAdded={() => onOpenChange(false)}
          onSelectDinners={onSelectDinners}
        />
      </ResponsiveModalContent>
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
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const utils = api.useUtils();
  const sources = api.shoppingList.sources.useQuery();
  const previews = suggestShoppingItems(query, sources.data ?? []);
  const add = api.shoppingList.addSelection.useMutation({
    networkMode: "always",
    retry: false,
    onSuccess: async () => {
      await utils.shoppingList.invalidate();
      onAdded();
    },
  });

  return (
    <div data-typing={typing} className="flex min-h-0 flex-1 flex-col">
      <ResponsiveModalTitle className="sr-only">
        Add an item
      </ResponsiveModalTitle>
      <ResponsiveModalDescription className="sr-only">
        Add to your shopping list
      </ResponsiveModalDescription>
      {typing && (
        <ResponsiveModalScrollViewport
          className="mb-3 flex-1"
          id="shopping-suggestions"
          role="listbox"
          aria-label="Shopping suggestions"
        >
          {previews.map((preview, index) => (
            <button
              key={JSON.stringify([preview.name, preview.note])}
              id={`shopping-suggestion-${index}`}
              ref={(element) => {
                optionRefs.current[index] = element;
              }}
              type="button"
              role="option"
              aria-selected={highlighted === index}
              aria-label={
                preview.note ? `${preview.name}, ${preview.note}` : preview.name
              }
              className="aria-selected:bg-accent hover:bg-accent focus-visible:bg-accent block w-full rounded-lg px-3 py-3 text-left focus-visible:outline-none"
              disabled={add.isPending}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => add.mutate(preview.selection)}
            >
              <span className="font-medium">{preview.name}</span>
              {preview.note && (
                <span className="text-muted-foreground ml-1 text-sm">
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
            add.mutate(
              (highlighted === null
                ? undefined
                : previews[highlighted]?.selection) ?? {
                name: query,
                note: null,
              },
            );
        }}
      >
        <label htmlFor="shopping-item-name" className="sr-only">
          Item name
        </label>
        <Input
          id="shopping-item-name"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={typing && previews.length > 0}
          aria-controls="shopping-suggestions"
          aria-activedescendant={
            highlighted === null
              ? undefined
              : `shopping-suggestion-${highlighted}`
          }
          autoComplete="off"
          enterKeyHint="done"
          placeholder="Add an item"
          className="h-[50px] min-w-0 rounded-xl bg-white text-base"
          value={query}
          readOnly={add.isPending}
          onFocus={() => setTyping(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setHighlighted(null);
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) {
              if (event.key === "Enter") event.preventDefault();
              return;
            }
            if (
              (event.key === "ArrowDown" || event.key === "ArrowUp") &&
              previews.length
            ) {
              event.preventDefault();
              const next =
                highlighted === null
                  ? event.key === "ArrowDown"
                    ? 0
                    : previews.length - 1
                  : (highlighted +
                      (event.key === "ArrowDown" ? 1 : -1) +
                      previews.length) %
                    previews.length;
              setHighlighted(next);
              optionRefs.current[next]?.scrollIntoView({ block: "nearest" });
            }
          }}
        />
      </form>
      {add.isError && (
        <p role="alert" className="text-destructive mt-3 shrink-0 text-sm">
          Could not add the item. Check your connection and try again.
        </p>
      )}
      {sources.isError && query.trim() && (
        <p role="alert" className="text-destructive mt-3 shrink-0 text-sm">
          Could not load suggestions. Try again.
        </p>
      )}
      {!typing && (
        <div className="mt-4 border-t pt-4">
          <DinnerSourceActions onSelect={onSelectDinners} />
        </div>
      )}
    </div>
  );
}
