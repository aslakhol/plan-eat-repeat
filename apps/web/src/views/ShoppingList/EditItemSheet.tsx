import {
  amountInputSchema,
  formatAmount,
  parseAmount,
  UNITS,
} from "@planeatrepeat/shared";
import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalTitle,
} from "~/components/ResponsiveModal";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { api, type RouterOutputs } from "~/utils/api";

export function EditItemSheet({
  item,
  onClose,
}: {
  item: RouterOutputs["shoppingList"]["list"][number];
  onClose: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [note, setNote] = useState(item.note ?? "");
  const [amount, setAmount] = useState(
    item.amount === null ? "" : formatAmount(item.amount),
  );
  const [unit, setUnit] = useState(item.unit ?? "");
  const ingredientNames = api.dinner.ingredientNames.useQuery();
  const utils = api.useUtils();
  const onSuccess = async () => {
    await utils.shoppingList.list.invalidate();
    onClose();
  };
  const edit = api.shoppingList.edit.useMutation({
    networkMode: "always",
    retry: false,
    onSuccess,
  });
  const remove = api.shoppingList.remove.useMutation({
    networkMode: "always",
    retry: false,
    onSuccess,
  });
  const pending = edit.isPending || remove.isPending;
  const parsedAmount = parseAmount(amount);
  const amountValid =
    amountInputSchema.safeParse(amount).success &&
    (parsedAmount === null || Number.isFinite(parsedAmount));

  return (
    <ResponsiveModal
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <ResponsiveModalContent
        className="h-auto max-h-[90dvh] rounded-t-3xl bg-white p-5 pb-8 md:rounded-2xl md:pt-10"
        scrollViewport
      >
        <ResponsiveModalTitle className="sr-only">
          Edit item
        </ResponsiveModalTitle>
        <ResponsiveModalDescription className="sr-only">
          Edit shopping item details
        </ResponsiveModalDescription>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim() && amountValid && !pending)
              edit.mutate({
                id: item.id,
                name,
                note,
                amount: parsedAmount,
                unit,
              });
          }}
        >
          <fieldset disabled={pending} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-shopping-name">Item</Label>
              <Input
                id="edit-shopping-name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="bg-background h-12 rounded-xl font-serif text-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-shopping-note">Note</Label>
              <Textarea
                id="edit-shopping-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="bg-background min-h-12 rounded-xl"
              />
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,132px)] gap-2.5">
              <div className="space-y-1.5">
                <Label htmlFor="edit-shopping-amount">Amount</Label>
                <div className="bg-background border-border flex h-12 items-center rounded-xl border px-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Decrease amount"
                    className="text-primary shrink-0"
                    disabled={
                      !amountValid || parsedAmount === null || parsedAmount <= 1
                    }
                    onClick={() => setAmount(formatAmount(parsedAmount! - 1))}
                  >
                    <Minus className="size-4" />
                  </Button>
                  <Input
                    id="edit-shopping-amount"
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    aria-invalid={!amountValid}
                    aria-describedby={
                      !amountValid ? "shopping-amount-error" : undefined
                    }
                    className="h-9 min-w-0 bg-white px-1 text-center font-bold"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Increase amount"
                    className="text-primary shrink-0"
                    disabled={!amountValid}
                    onClick={() =>
                      setAmount(formatAmount((parsedAmount ?? 0) + 1))
                    }
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-shopping-unit">Unit</Label>
                <Input
                  id="edit-shopping-unit"
                  list="shopping-item-units"
                  autoComplete="off"
                  value={unit}
                  onChange={(event) => setUnit(event.target.value)}
                  className="bg-background h-12 rounded-xl"
                />
                <datalist id="shopping-item-units">
                  {(ingredientNames.data?.ingredientUnits ?? UNITS).map(
                    (suggestion) => (
                      <option key={suggestion} value={suggestion} />
                    ),
                  )}
                </datalist>
              </div>
            </div>
            {!amountValid && (
              <p
                id="shopping-amount-error"
                role="alert"
                className="text-destructive text-sm"
              >
                Amount must be a number more than 0
              </p>
            )}
            {(edit.isError || remove.isError) && (
              <p role="alert" className="text-destructive text-sm">
                Could not {remove.isError ? "remove" : "save"} the item. Check
                your connection and try again.
              </p>
            )}
            <div className="flex gap-2.5 pt-1">
              <Button
                type="button"
                variant="outline"
                className="h-12 rounded-xl px-6"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="h-12 flex-1 rounded-xl"
                disabled={!name.trim() || !amountValid}
              >
                {edit.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
            <button
              type="button"
              className="text-destructive w-full py-2 text-sm font-semibold disabled:opacity-50"
              onClick={() => remove.mutate({ id: item.id })}
            >
              {remove.isPending ? "Removing…" : "Remove from list"}
            </button>
          </fieldset>
        </form>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
