import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalScrollViewport,
  ResponsiveModalTitle,
} from "~/components/ResponsiveModal";
import { Input } from "~/components/ui/input";
import {
  shoppingIdentity,
  suggestShoppingItems,
} from "~/lib/shopping-matching";
import { api } from "~/utils/api";
import { DinnerSourceActions } from "./DinnerSourceActions";
import { type ShoppingDinnerSource } from "./DinnerPicker";
import { type ShoppingPreview } from "./use-add-shopping-item";

export function AddItemSheet({
  open,
  onOpenChange,
  onSelectDinners,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (preview: ShoppingPreview) => void;
  onSelectDinners: (source: ShoppingDinnerSource) => void;
}) {
  const [mobileStyle, setMobileStyle] = useState<CSSProperties>();

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!open || !viewport) return;

    const updateViewport = () => {
      // Use the fixed containing block's height, not innerHeight: iOS browser
      // chrome can make the two differ. Include any visual viewport panning.
      setMobileStyle({
        bottom: `max(0px, calc(100% - ${viewport.height + viewport.offsetTop}px))`,
        maxHeight: Math.min(600, viewport.height - 16),
      });
    };
    updateViewport();
    viewport.addEventListener("resize", updateViewport);
    viewport.addEventListener("scroll", updateViewport);
    return () => {
      viewport.removeEventListener("resize", updateViewport);
      viewport.removeEventListener("scroll", updateViewport);
    };
  }, [open]);

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent
        mobileStyle={mobileStyle}
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="flex h-auto flex-col gap-0 rounded-t-3xl bg-white p-5 pb-8 has-[[data-typing=true]]:h-[65dvh] has-[[data-typing=true]]:max-h-[600px] md:rounded-2xl md:pt-10"
      >
        <AddItemContent
          onAdd={(preview) => {
            onAdd(preview);
            onOpenChange(false);
          }}
          onSelectDinners={onSelectDinners}
        />
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

function AddItemContent({
  onAdd,
  onSelectDinners,
}: {
  onAdd: (preview: ShoppingPreview) => void;
  onSelectDinners: (source: ShoppingDinnerSource) => void;
}) {
  const [query, setQuery] = useState("");
  const [typing, setTyping] = useState(false);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const sources = api.shoppingList.sources.useQuery();
  const previews = suggestShoppingItems(query, sources.data ?? []);
  const highlightedIndex = previews.findIndex(
    (preview) => shoppingIdentity(preview.name, preview.note) === highlighted,
  );

  return (
    <div data-typing={typing} className="flex min-h-0 flex-1 flex-col">
      <ResponsiveModalTitle className="sr-only">
        Add an item
      </ResponsiveModalTitle>
      <ResponsiveModalDescription className="sr-only">
        Add to your shopping list
      </ResponsiveModalDescription>
      <form
        className="shrink-0"
        onSubmit={(event) => {
          event.preventDefault();
          if (query.trim())
            onAdd(
              previews[highlightedIndex] ?? {
                name: query.trim(),
                note: null,
                selection: { name: query, note: null },
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
            highlightedIndex < 0
              ? undefined
              : `shopping-suggestion-${highlightedIndex}`
          }
          autoComplete="off"
          enterKeyHint="done"
          placeholder="Add an item"
          className="h-[50px] min-w-0 rounded-xl bg-white text-base"
          value={query}
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
                highlightedIndex < 0
                  ? event.key === "ArrowDown"
                    ? 0
                    : previews.length - 1
                  : (highlightedIndex +
                      (event.key === "ArrowDown" ? 1 : -1) +
                      previews.length) %
                    previews.length;
              const preview = previews[next];
              if (preview)
                setHighlighted(shoppingIdentity(preview.name, preview.note));
              optionRefs.current[next]?.scrollIntoView({ block: "nearest" });
            }
          }}
        />
      </form>
      {typing && (
        <ResponsiveModalScrollViewport
          className="mt-3 flex-1 space-y-2 md:order-first md:mb-3 md:mt-0"
          id="shopping-suggestions"
          role="listbox"
          aria-label="Shopping suggestions"
        >
          {previews.map((preview, index) => (
            <button
              key={shoppingIdentity(preview.name, preview.note)}
              id={`shopping-suggestion-${index}`}
              ref={(element) => {
                optionRefs.current[index] = element;
              }}
              type="button"
              role="option"
              aria-selected={highlightedIndex === index}
              aria-label={
                preview.note ? `${preview.name}, ${preview.note}` : preview.name
              }
              className="bg-secondary/70 aria-selected:bg-secondary hover:bg-secondary focus-visible:bg-secondary block w-full rounded-[14px] px-3.5 py-3 text-left focus-visible:outline-none"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onAdd(preview)}
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
