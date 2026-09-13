import { MoreHorizontal, Plus } from "lucide-react";
import { useRef, useState } from "react";
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
import { cn } from "~/lib/utils";
import { api, type RouterOutputs } from "~/utils/api";
import { AddItemSheet } from "./AddItemSheet";

type ShoppingItem = RouterOutputs["shoppingList"]["list"][number];

function ShoppingItemRow({ item }: { item: ShoppingItem }) {
  const [removing, setRemoving] = useState(false);
  const utils = api.useUtils();
  const remove = api.shoppingList.remove.useMutation({
    networkMode: "always",
    retry: false,
    onSuccess: () => utils.shoppingList.list.invalidate(),
  });

  const removeItem = async () => {
    setRemoving(true);
    await new Promise((resolve) => window.setTimeout(resolve, 200));
    try {
      await remove.mutateAsync({ id: item.id });
    } catch {
      // The mutation cache displays the error. Keep the unsaved item on the list.
    } finally {
      setRemoving(false);
    }
  };

  return (
    <li>
      <button
        type="button"
        aria-label={`Remove ${item.name} from list`}
        disabled={removing}
        onClick={() => void removeItem()}
        className={cn(
          "bg-secondary/70 hover:bg-secondary focus-visible:ring-ring min-h-14 w-full rounded-[14px] px-3.5 py-3 text-left font-serif text-[17px] outline-none transition-opacity [overflow-wrap:anywhere] focus-visible:ring-2",
          removing && "text-muted-foreground line-through opacity-50",
        )}
      >
        {item.name}
      </button>
    </li>
  );
}

export function ShoppingListView() {
  const [addOpen, setAddOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const utils = api.useUtils();
  const list = api.shoppingList.list.useQuery(undefined, {
    refetchInterval: 2000,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    retry: false,
  });
  const clear = api.shoppingList.clear.useMutation({
    networkMode: "always",
    retry: false,
    onSuccess: async () => {
      await utils.shoppingList.list.invalidate();
      setClearOpen(false);
    },
  });

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h1 className="font-serif text-[30px] leading-tight">Shopping list</h1>
        <DetailsMenu ref={menuRef} className="relative">
          <summary className="border-border text-muted-foreground flex size-9 cursor-pointer list-none items-center justify-center rounded-full border [&::-webkit-details-marker]:hidden">
            <MoreHorizontal className="size-5" />
            <span className="sr-only">Shopping list actions</span>
          </summary>
          <div className="border-border absolute right-0 z-20 mt-2 w-44 rounded-xl border bg-white p-1 shadow-lg">
            <button
              type="button"
              className="hover:bg-muted w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold disabled:opacity-50"
              disabled={!list.data?.length}
              onClick={() => {
                menuRef.current?.removeAttribute("open");
                setClearOpen(true);
              }}
            >
              Clear the list
            </button>
          </div>
        </DetailsMenu>
      </header>

      {list.isPending && (
        <p role="status" className="text-muted-foreground py-8 text-center">
          Loading shopping list…
        </p>
      )}
      {list.isError && (
        <p role="alert" className="text-destructive mb-4 text-sm">
          Could not refresh the list. Check your connection.
        </p>
      )}
      {list.data &&
        (list.data.length === 0 ? (
          <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-5 px-4">
            <h2 className="font-serif text-xl">Nothing on the list</h2>
            <Button
              variant="outline"
              className="h-12 w-full max-w-sm rounded-xl bg-white"
              onClick={() => setAddOpen(true)}
            >
              Add an item
            </Button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="border-border text-muted-foreground mb-2 flex min-h-12 w-full items-center gap-2 rounded-[14px] border border-dashed px-3.5 text-sm font-semibold"
            >
              <Plus className="size-4" /> Add an item
            </button>
            <ul className="space-y-2" aria-label="Shopping items">
              {list.data.map((item) => (
                <ShoppingItemRow key={item.id} item={item} />
              ))}
            </ul>
          </>
        ))}

      <AddItemSheet open={addOpen} onOpenChange={setAddOpen} />
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
