import { OdaShoppingMenu } from "./OdaShoppingMenu";
import { OdaTransferProgress } from "./OdaTransferProgress";
import { useOdaShopping } from "./use-oda-shopping";
import {
  ChevronDown,
  MoreHorizontal,
  Plus,
  Share2,
  UtensilsCrossed,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { DetailsMenu } from "~/components/ui/details-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { api, type RouterOutputs } from "~/utils/api";
import { toast } from "~/components/ui/use-toast";
import { cn } from "~/lib/utils";
import {
  shoppingCategoriesQueryOptions,
  shoppingChoicesQueryOptions,
} from "~/lib/query-freshness";
import { shoppingIdentity } from "~/lib/shopping-matching";
import { useShopping } from "./ShoppingProvider";
import { AddItemSheet } from "./AddItemSheet";
import { EditItemSheet } from "./EditItemSheet";
import { DinnerPicker, type ShoppingDinnerSource } from "./DinnerPicker";
import { DinnerSourceActions } from "./DinnerSourceActions";
import {
  ShoppingItemCreationTrigger,
  useShoppingItemCreation,
} from "./ShoppingItemCreationContext";

type ShoppingItem = RouterOutputs["shoppingList"]["list"][number];
const RECENT_OPEN_KEY = "plan-eat-repeat:recently-used-open";

function ShoppingItemRow({
  item,
  onEdit,
  onMove,
  recent = false,
  pending = false,
  moveDisabled = false,
}: {
  item: ShoppingItem;
  onEdit: () => void;
  onMove: () => void;
  recent?: boolean;
  pending?: boolean;
  moveDisabled?: boolean;
}) {
  const label = [item.name, item.note].filter(Boolean).join(", ");

  return (
    <li className="bg-secondary/70 flex items-center rounded-[14px]">
      <button
        type="button"
        aria-label={
          recent ? `Add ${label} to shopping list` : `Remove ${label} from list`
        }
        disabled={moveDisabled}
        onClick={onMove}
        className="hover:bg-secondary focus-visible:ring-ring flex min-h-14 min-w-0 flex-1 items-center gap-2 rounded-[14px] px-3.5 py-3 text-left outline-none [overflow-wrap:anywhere] focus-visible:ring-2"
      >
        {recent && <Plus className="text-muted-foreground size-4 shrink-0" />}
        <span>
          <span className="font-serif text-[17px]">{item.name}</span>
          {item.note && (
            <span className="text-muted-foreground ml-1 text-[13px]">
              {item.note}
            </span>
          )}
        </span>
      </button>
      {(item.amount !== null || item.unit !== null) && (
        <button
          type="button"
          aria-label={`Edit quantity for ${label}`}
          disabled={pending}
          onClick={onEdit}
          className="bg-background border-border hover:bg-accent focus-visible:ring-ring max-w-[35%] rounded-lg border px-2 py-1 text-sm font-semibold outline-none [overflow-wrap:anywhere] focus-visible:ring-2"
        >
          {[item.amount, item.unit].filter((value) => value !== null).join(" ")}
        </button>
      )}
      <button
        type="button"
        aria-label={`Edit ${label}`}
        disabled={pending}
        onClick={onEdit}
        className="text-muted-foreground border-border hover:bg-accent focus-visible:ring-ring mx-2 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-white outline-none focus-visible:ring-2"
      >
        <MoreHorizontal className="size-5" />
      </button>
    </li>
  );
}

export function ShoppingListView() {
  const { close } = useShoppingItemCreation();
  const {
    addItem,
    pendingItems,
    list,
    recent,
    moveItem,
    items,
    recentItems: movedRecentItems,
    pendingOwnIds,
  } = useShopping();
  const pendingIdentities = new Set(
    pendingItems.map((item) => shoppingIdentity(item.name, item.note)),
  );
  const [pickerSource, setPickerSource] = useState<ShoppingDinnerSource | null>(
    null,
  );
  const openPicker = (source: ShoppingDinnerSource) => {
    close();
    setPickerSource(source);
  };
  const [clearOpen, setClearOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [editingItem, setEditingItem] = useState<{
    item: ShoppingItem;
    recent: boolean;
  } | null>(null);
  const [recentOpen, setRecentOpen] = useState(true);
  useEffect(() => {
    try {
      setRecentOpen(localStorage.getItem(RECENT_OPEN_KEY) !== "false");
    } catch {
      // The accordion still works when browser storage is unavailable.
    }
  }, []);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const utils = api.useUtils();
  // Wait for the page's essential reads so preparation uses a later HTTP batch.
  const readyToPrepare = !list.isPending && !recent.isPending;
  useEffect(() => {
    if (!readyToPrepare) return;
    void utils.shoppingList.sources.prefetch(
      undefined,
      shoppingChoicesQueryOptions,
    );
    void utils.shoppingList.categories.prefetch(
      undefined,
      shoppingCategoriesQueryOptions,
    );
  }, [readyToPrepare, utils]);
  // Keep pending additions separate so polling cannot erase them, and only
  // deduplicate the unspecified requirements created by autocomplete.
  const optimisticItems = pendingItems.filter((item, index) => {
    const identity = shoppingIdentity(item.name, item.note);
    return (
      pendingItems.findIndex(
        (other) => shoppingIdentity(other.name, other.note) === identity,
      ) === index &&
      !items.some(
        (saved) =>
          saved.amount === null &&
          saved.unit === null &&
          shoppingIdentity(saved.name, saved.note) === identity,
      )
    );
  });
  const hasItems = items.length > 0 || optimisticItems.length > 0;
  const oda = useOdaShopping(
    items,
    pendingItems.length > 0 || pendingOwnIds.size > 0,
  );
  const recentItems = movedRecentItems.filter(
    (item) => !pendingIdentities.has(shoppingIdentity(item.name, item.note)),
  );
  const clear = api.shoppingList.clear.useMutation({
    networkMode: "always",
    retry: false,
    onSuccess: async () => {
      await utils.shoppingList.invalidate();
      setClearOpen(false);
    },
  });

  const shareDisabled =
    !items.length ||
    pendingItems.length > 0 ||
    pendingOwnIds.size > 0 ||
    sharing;
  const shoppingText = [
    "Shopping list",
    "",
    ...items.map((item) => {
      const quantity = [item.amount, item.unit]
        .filter((value) => value !== null)
        .join(" ");
      const label = [item.name, item.note].filter(Boolean).join(", ");
      return [quantity, label].filter(Boolean).join(" ").replace(/\s+/g, " ");
    }),
  ].join("\n");

  const copyList = async () => {
    try {
      await navigator.clipboard.writeText(shoppingText);
      toast({ title: "Shopping list copied" });
    } catch {
      toast({ variant: "destructive", title: "Could not copy shopping list" });
    }
  };

  const shareList = async () => {
    const data = { text: shoppingText };
    if (!navigator.share || (navigator.canShare && !navigator.canShare(data))) {
      await copyList();
      return;
    }
    setSharing(true);
    try {
      await navigator.share(data);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast({
        variant: "destructive",
        title: "Could not share shopping list",
        description: "Use Copy list in the shopping list menu.",
      });
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-4 flex items-center justify-between gap-2">
        <h1 className="min-w-0 flex-1 font-serif text-[30px] leading-tight max-[360px]:text-[26px]">
          Shopping list
        </h1>
        <Button
          variant="outline"
          size="sm"
          className="h-9 shrink-0 gap-1.5 rounded-full bg-white px-3 max-[360px]:w-9 max-[360px]:px-0"
          disabled={shareDisabled}
          onClick={() => void shareList()}
        >
          <Share2 aria-hidden="true" className="size-4" />
          <span className="max-[360px]:sr-only">Share</span>
        </Button>
        <DetailsMenu ref={menuRef} className="relative">
          <Button
            asChild
            variant="outline"
            size="icon"
            className="size-9 shrink-0 rounded-full bg-white"
          >
            <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              <MoreHorizontal className="size-4" />
              <span className="sr-only">Shopping list actions</span>
            </summary>
          </Button>
          <div className="border-border absolute right-0 z-20 mt-2 w-44 rounded-xl border bg-white p-1 shadow-lg">
            <button
              type="button"
              className="hover:bg-muted w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold disabled:opacity-50"
              disabled={shareDisabled}
              onClick={() => {
                menuRef.current?.removeAttribute("open");
                void copyList();
              }}
            >
              Copy list
            </button>
            <Link
              href="/shopping-list/usually-have"
              className="hover:bg-muted block w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold"
              onClick={() => menuRef.current?.removeAttribute("open")}
            >
              Usually have
            </Link>
            <button
              type="button"
              className="hover:bg-muted w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold disabled:opacity-50"
              disabled={
                !items.length ||
                pendingItems.length > 0 ||
                pendingOwnIds.size > 0
              }
              onClick={() => {
                menuRef.current?.removeAttribute("open");
                setClearOpen(true);
              }}
            >
              Clear the list
            </button>
            <OdaShoppingMenu
              oda={oda}
              onAction={() => menuRef.current?.removeAttribute("open")}
            />
          </div>
        </DetailsMenu>
      </header>
      <OdaTransferProgress oda={oda} />

      {list.isPending && (
        <div role="status" className="flex items-center justify-center py-8">
          <UtensilsCrossed
            aria-hidden="true"
            className="text-primary animate-spin"
          />
          <span className="sr-only">Loading shopping list…</span>
        </div>
      )}
      {list.isError && (
        <p role="alert" className="text-destructive mb-4 text-sm">
          Could not refresh the list. Check your connection.
        </p>
      )}
      {(list.data !== undefined || optimisticItems.length > 0) &&
        (!hasItems && !oda.progress ? (
          <div
            className={cn(
              "flex flex-col items-center justify-center gap-5 px-4",
              recentItems.length ? "min-h-[35dvh] py-8" : "min-h-[60dvh]",
            )}
          >
            <h2 className="font-serif text-xl">Nothing on the list</h2>
            <div className="flex w-full max-w-sm flex-col gap-2.5">
              <ShoppingItemCreationTrigger>
                <Button
                  variant="outline"
                  className="h-12 w-full max-w-sm rounded-xl bg-white"
                >
                  Add an item
                </Button>
              </ShoppingItemCreationTrigger>
              <DinnerSourceActions onSelect={openPicker} />
            </div>
          </div>
        ) : (
          <>
            <ShoppingItemCreationTrigger>
              <button
                type="button"
                className="border-border text-muted-foreground mb-2 flex min-h-12 w-full items-center gap-2 rounded-[14px] border border-dashed px-3.5 text-sm font-semibold"
              >
                <Plus className="size-4" /> Add an item
              </button>
            </ShoppingItemCreationTrigger>
            <ul className="space-y-2" aria-label="Shopping items">
              {items.map((item) => (
                <ShoppingItemRow
                  key={item.id}
                  item={item}
                  pending={
                    pendingOwnIds.has(item.ownItemId) ||
                    pendingIdentities.has(
                      shoppingIdentity(item.name, item.note),
                    )
                  }
                  moveDisabled={pendingIdentities.has(
                    shoppingIdentity(item.name, item.note),
                  )}
                  onMove={() => moveItem({ item, recent: false })}
                  onEdit={() => setEditingItem({ item, recent: false })}
                />
              ))}
              {optimisticItems.map((item) => (
                <li
                  key={item.id}
                  aria-busy="true"
                  className="bg-secondary/70 flex min-h-14 items-center rounded-[14px] px-3.5 py-3 [overflow-wrap:anywhere]"
                >
                  <span>
                    <span className="font-serif text-[17px]">{item.name}</span>
                    {item.note && (
                      <span className="text-muted-foreground ml-1 text-[13px]">
                        {item.note}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ))}

      {recent.isError && (
        <p role="alert" className="text-destructive mt-4 text-sm">
          Could not refresh recently used items. Check your connection.
        </p>
      )}
      {list.data && recentItems.length > 0 && (
        <section className="mt-6" aria-label="Recently used">
          <h2>
            <button
              type="button"
              aria-expanded={recentOpen}
              aria-controls="recent-shopping-items"
              className="focus-visible:ring-ring mb-2 flex min-h-12 w-full items-center justify-between rounded-lg text-left font-serif text-xl outline-none focus-visible:ring-2"
              onClick={() => {
                const open = !recentOpen;
                setRecentOpen(open);
                try {
                  localStorage.setItem(RECENT_OPEN_KEY, String(open));
                } catch {
                  // Keep the choice in memory when browser storage is unavailable.
                }
              }}
            >
              Recently used
              <ChevronDown
                className={cn(
                  "size-5 transition-transform",
                  recentOpen && "rotate-180",
                )}
              />
            </button>
          </h2>
          <ul
            id="recent-shopping-items"
            hidden={!recentOpen}
            className="space-y-2"
            aria-label="Recently used items"
          >
            {recentItems.map((item) => (
              <ShoppingItemRow
                key={item.id}
                item={item}
                recent
                pending={pendingOwnIds.has(item.ownItemId)}
                onMove={() => moveItem({ item, recent: true })}
                onEdit={() => setEditingItem({ item, recent: true })}
              />
            ))}
          </ul>
        </section>
      )}

      <AddItemSheet onAdd={addItem} onSelectDinners={openPicker} />
      {pickerSource && (
        <DinnerPicker
          initialSource={pickerSource}
          onClose={() => setPickerSource(null)}
        />
      )}
      {editingItem && (
        <EditItemSheet
          item={editingItem.item}
          recent={editingItem.recent}
          onClose={() => setEditingItem(null)}
        />
      )}
      <Dialog open={clearOpen} onOpenChange={setClearOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Clear the list?</DialogTitle>
            <DialogDescription>
              Remove all items from your shopping list?
            </DialogDescription>
          </DialogHeader>
          {clear.isError && (
            <p role="alert" className="text-destructive text-sm">
              Could not clear the list. Try again.
            </p>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setClearOpen(false)}
              disabled={clear.isPending}
            >
              Cancel
            </Button>
            <Button onClick={() => clear.mutate()} disabled={clear.isPending}>
              {clear.isPending ? "Clearing…" : "Clear the list"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
