import { MoreHorizontal, Plus } from "lucide-react";
import Link from "next/link";
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
import { api, type RouterOutputs } from "~/utils/api";
import { AddItemSheet } from "./AddItemSheet";
import { EditItemSheet } from "./EditItemSheet";
import { DinnerPicker, type ShoppingDinnerSource } from "./DinnerPicker";
import { DinnerSourceActions } from "./DinnerSourceActions";

type ShoppingItem = RouterOutputs["shoppingList"]["list"][number];

function ShoppingItemRow({
  item,
  onEdit,
}: {
  item: ShoppingItem;
  onEdit: () => void;
}) {
  const utils = api.useUtils();
  const remove = api.shoppingList.remove.useMutation({
    networkMode: "always",
    retry: false,
    onSuccess: () => utils.shoppingList.list.invalidate(),
  });

  if (remove.isPending) return null;

  return (
    <li className="bg-secondary/70 flex items-center rounded-[14px]">
      <button
        type="button"
        aria-label={`Remove ${item.name} from list`}
        onClick={() => remove.mutate({ id: item.id })}
        className="hover:bg-secondary focus-visible:ring-ring min-h-14 min-w-0 flex-1 rounded-[14px] px-3.5 py-3 text-left outline-none [overflow-wrap:anywhere] focus-visible:ring-2"
      >
        <span className="font-serif text-[17px]">{item.name}</span>
        {item.note && (
          <span className="text-muted-foreground ml-1 text-[13px]">
            {item.note}
          </span>
        )}
      </button>
      {(item.amount !== null || item.unit !== null) && (
        <button
          type="button"
          aria-label={`Edit quantity for ${item.name}`}
          onClick={onEdit}
          className="bg-background border-border hover:bg-accent focus-visible:ring-ring max-w-[35%] rounded-lg border px-2 py-1 text-sm font-semibold outline-none [overflow-wrap:anywhere] focus-visible:ring-2"
        >
          {[item.amount, item.unit].filter((value) => value !== null).join(" ")}
        </button>
      )}
      <button
        type="button"
        aria-label={`Edit ${item.name}`}
        onClick={onEdit}
        className="text-muted-foreground border-border hover:bg-accent focus-visible:ring-ring mx-2 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-white outline-none focus-visible:ring-2"
      >
        <MoreHorizontal className="size-5" />
      </button>
    </li>
  );
}

export function ShoppingListView() {
  const [addOpen, setAddOpen] = useState(false);
  const [pickerSource, setPickerSource] = useState<ShoppingDinnerSource | null>(
    null,
  );
  const openPicker = (source: ShoppingDinnerSource) => {
    setAddOpen(false);
    setPickerSource(source);
  };
  const [clearOpen, setClearOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null);
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
            <div className="flex w-full max-w-sm flex-col gap-2.5">
              <Button
                variant="outline"
                className="h-12 w-full max-w-sm rounded-xl bg-white"
                onClick={() => setAddOpen(true)}
              >
                Add an item
              </Button>
              <DinnerSourceActions onSelect={openPicker} />
            </div>
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
                <ShoppingItemRow
                  key={item.id}
                  item={item}
                  onEdit={() => setEditingItem(item)}
                />
              ))}
            </ul>
          </>
        ))}

      <AddItemSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        onSelectDinners={openPicker}
      />
      {pickerSource && (
        <DinnerPicker
          initialSource={pickerSource}
          onClose={() => setPickerSource(null)}
        />
      )}
      {editingItem && (
        <EditItemSheet
          item={editingItem}
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
