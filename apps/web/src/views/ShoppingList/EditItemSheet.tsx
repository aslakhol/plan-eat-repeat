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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";
import {
  shoppingCategoriesQueryOptions,
  shoppingChoicesQueryOptions,
} from "~/lib/query-freshness";
import { api, type RouterOutputs } from "~/utils/api";
import type { OdaProductPreference } from "~/lib/oda-product";
import { useShopping } from "./ShoppingProvider";
import type { ShoppingEdit } from "./use-edit-shopping-item";
import { OdaProductPicker } from "./OdaProductPicker";

export function EditItemSheet({
  item,
  onClose,
  recent = false,
  draft,
  failedKey,
}: {
  item: RouterOutputs["shoppingList"]["list"][number];
  onClose: () => void;
  recent?: boolean;
  draft?: ShoppingEdit["input"];
  failedKey?: string;
}) {
  const { editItem, editingOwnIds } = useShopping();
  const categories = api.shoppingList.categories.useQuery(undefined, {
    ...shoppingCategoriesQueryOptions,
    retry: false,
  });
  const [name, setName] = useState(draft?.name ?? item.name);
  const [note, setNote] = useState(
    draft ? (draft.note ?? "") : (item.note ?? ""),
  );
  const initialAmount = item.amount === null ? "" : formatAmount(item.amount);
  const [amount, setAmount] = useState(
    draft
      ? draft.amount === null
        ? ""
        : formatAmount(draft.amount)
      : initialAmount,
  );
  const [unit, setUnit] = useState(
    draft ? (draft.unit ?? "") : (item.unit ?? ""),
  );
  const [categoryDraft, setCategoryDraft] = useState<
    typeof item.ownItem.category | undefined
  >(draft?.category);
  const [excludedDraft, setExcludedDraft] = useState<boolean | undefined>(
    draft?.usuallyHave,
  );
  const odaStatus = api.oda.status.useQuery(undefined, {
    refetchInterval: 2000,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    retry: false,
  });
  const odaConnected =
    odaStatus.data?.connected && !odaStatus.data.reconnectRequired;
  const [odaProductDraft, setOdaProductDraft] = useState<
    OdaProductPreference | null | undefined
  >(draft?.odaProduct);
  const odaProduct =
    odaProductDraft !== undefined
      ? odaProductDraft
      : item.ownItem.odaProductId !== null
        ? {
            id: item.ownItem.odaProductId,
            name: item.ownItem.odaProductName!,
            description: item.ownItem.odaProductDescription!,
          }
        : null;
  const excluded = excludedDraft ?? item.ownItem.usuallyHave;
  const [unitFocused, setUnitFocused] = useState(false);
  const ingredientNames = api.dinner.ingredientNames.useQuery(undefined, {
    ...shoppingChoicesQueryOptions,
    enabled: unitFocused,
  });
  const utils = api.useUtils();
  const refreshAndClose = async (deleted: boolean) => {
    await Promise.all([
      utils.shoppingList.list.invalidate(),
      utils.shoppingList.recent.invalidate(),
      ...(name !== item.name ||
      note !== (item.note ?? "") ||
      categoryDraft !== undefined ||
      deleted
        ? [utils.shoppingList.sources.invalidate()]
        : []),
      ...(excludedDraft !== undefined ||
      name !== item.name ||
      note !== (item.note ?? "") ||
      deleted
        ? [utils.shoppingList.usuallyHave.invalidate()]
        : []),
    ]);
    onClose();
  };
  const deleteOwnItem = api.shoppingList.deleteOwnItem.useMutation({
    networkMode: "always",
    retry: false,
    onSuccess: () => refreshAndClose(true),
  });
  const pending = deleteOwnItem.isPending;
  const parsedAmount = parseAmount(amount);
  const amountValid =
    amountInputSchema.safeParse(amount).success &&
    (parsedAmount === null || Number.isFinite(parsedAmount));
  const nameValid = name.trim().length > 0;
  const saveAndClose = () => {
    if (pending) return;
    const changed =
      draft !== undefined ||
      name !== item.name ||
      note !== (item.note ?? "") ||
      amount !== initialAmount ||
      unit !== (item.unit ?? "") ||
      categoryDraft !== undefined ||
      excludedDraft !== undefined ||
      (odaConnected && odaProductDraft !== undefined);
    if (!changed) {
      onClose();
      return;
    }
    if (!nameValid || !amountValid) return;
    editItem(
      {
        item,
        recent,
        input: {
          id: item.id,
          name,
          note,
          amount: parsedAmount,
          unit,
          usuallyHave: excludedDraft,
          category: categoryDraft,
          odaProduct: odaConnected ? odaProductDraft : undefined,
        },
      },
      failedKey,
    );
    onClose();
  };

  return (
    <ResponsiveModal
      open
      onOpenChange={(open) => {
        if (!open) saveAndClose();
      }}
    >
      <ResponsiveModalContent
        className="h-auto max-h-[90dvh] rounded-t-3xl bg-white p-5 pb-8 md:rounded-2xl"
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
            saveAndClose();
          }}
        >
          <fieldset disabled={pending} className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Label htmlFor="edit-shopping-name" className="sr-only">
                  Item
                </Label>
                <Input
                  id="edit-shopping-name"
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  aria-invalid={!nameValid}
                  aria-describedby={
                    !nameValid ? "shopping-name-error" : undefined
                  }
                  className="bg-background h-12 min-w-0 flex-1 rounded-xl font-serif text-xl"
                />
                <Button
                  type="submit"
                  variant="ghost"
                  disabled={!nameValid || !amountValid}
                  className="text-primary h-12 shrink-0 rounded-xl px-3"
                >
                  Done
                </Button>
              </div>
              {!nameValid && (
                <p
                  id="shopping-name-error"
                  role="alert"
                  className="text-destructive text-sm"
                >
                  Enter an item name
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-shopping-note">Note</Label>
              <Input
                id="edit-shopping-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="bg-background h-12 rounded-xl"
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
                  onFocus={() => setUnitFocused(true)}
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
            <div className="space-y-1.5">
              <Label htmlFor="edit-shopping-category">Category</Label>
              <Select
                value={categoryDraft ?? ""}
                disabled={!categories.isSuccess || pending}
                onValueChange={(value) =>
                  setCategoryDraft(
                    categories.data?.find((category) => category.id === value)
                      ?.id,
                  )
                }
              >
                <SelectTrigger
                  id="edit-shopping-category"
                  className="h-12 rounded-xl text-black data-[placeholder]:text-black"
                >
                  <SelectValue
                    placeholder={
                      categories.data?.find(
                        (category) => category.id === item.ownItem.category,
                      )?.label ?? "Loading categories…"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {categories.data?.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {categories.isError && (
              <p role="alert" className="text-destructive text-sm">
                Could not load categories.
                <button type="button" onClick={() => void categories.refetch()}>
                  Try again
                </button>
              </p>
            )}
            {odaConnected && (
              <OdaProductPicker
                product={odaProduct}
                itemName={name}
                onChange={setOdaProductDraft}
              />
            )}
            <div className="border-border flex items-center justify-between gap-4 rounded-xl border p-3.5">
              <Label
                htmlFor="edit-shopping-excluded"
                className="text-sm font-semibold leading-snug"
              >
                Do not automatically add to shopping list
              </Label>
              <button
                id="edit-shopping-excluded"
                type="button"
                role="switch"
                aria-checked={excluded}
                onClick={() => setExcludedDraft(!excluded)}
                className={cn(
                  "focus-visible:ring-ring relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50",
                  excluded ? "bg-primary" : "bg-muted-foreground/30",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute left-1 top-1 size-5 rounded-full bg-white shadow-sm transition-transform",
                    excluded && "translate-x-5",
                  )}
                />
              </button>
            </div>
            {deleteOwnItem.isError && (
              <p role="alert" className="text-destructive text-sm">
                Could not delete the item. Check your connection and try again.
              </p>
            )}
            <div className="pt-1">
              <Button
                type="button"
                variant="outline"
                className="text-destructive hover:bg-destructive/5 hover:text-destructive h-12 w-full rounded-xl px-3"
                disabled={editingOwnIds.has(item.ownItemId)}
                onClick={() => deleteOwnItem.mutate({ id: item.ownItemId })}
              >
                {deleteOwnItem.isPending ? "Deleting…" : "Delete own item"}
              </Button>
            </div>
          </fieldset>
        </form>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
