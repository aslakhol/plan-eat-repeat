import {
  amountInputSchema,
  formatAmount,
  normalizeShoppingName,
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
import { api, type RouterOutputs } from "~/utils/api";

export function EditItemSheet({
  item,
  onClose,
  recent = false,
}: {
  item: RouterOutputs["shoppingList"]["list"][number];
  onClose: () => void;
  recent?: boolean;
}) {
  const categories = api.shoppingList.categories.useQuery(undefined, {
    refetchInterval: 2000,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    retry: false,
  });
  const [name, setName] = useState(item.name);
  const [note, setNote] = useState(item.note ?? "");
  const initialAmount = item.amount === null ? "" : formatAmount(item.amount);
  const [amount, setAmount] = useState(initialAmount);
  const [unit, setUnit] = useState(item.unit ?? "");
  const [categoryDraft, setCategoryDraft] =
    useState<typeof item.product.category>();
  const [excludedDraft, setExcludedDraft] = useState<boolean>();
  const preferences = api.shoppingList.usuallyHave.useQuery(undefined, {
    refetchInterval: 2000,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    retry: false,
  });
  const excluded =
    excludedDraft ??
    preferences.data?.some(
      (preference) => preference.normalizedName === normalizeShoppingName(name),
    ) ??
    false;
  const ingredientNames = api.dinner.ingredientNames.useQuery();
  const utils = api.useUtils();
  const onSuccess = async () => {
    await utils.shoppingList.invalidate();
    onClose();
  };
  const options = {
    networkMode: "always" as const,
    retry: false,
    onSuccess,
  };
  const editActive = api.shoppingList.edit.useMutation(options);
  const editRecent = api.shoppingList.editRecent.useMutation(options);
  const deleteProduct = api.shoppingList.deleteProduct.useMutation(options);
  const edit = recent ? editRecent : editActive;
  const pending = edit.isPending || deleteProduct.isPending;
  const parsedAmount = parseAmount(amount);
  const amountValid =
    amountInputSchema.safeParse(amount).success &&
    (parsedAmount === null || Number.isFinite(parsedAmount));
  const nameValid = name.trim().length > 0;
  const saveAndClose = () => {
    if (pending) return;
    const changed =
      name !== item.name ||
      note !== (item.note ?? "") ||
      amount !== initialAmount ||
      unit !== (item.unit ?? "") ||
      categoryDraft !== undefined ||
      excludedDraft !== undefined;
    if (!changed) {
      onClose();
      return;
    }
    if (!nameValid || !amountValid) return;
    edit.mutate({
      id: item.id,
      name,
      note,
      amount: parsedAmount,
      unit,
      usuallyHave: excludedDraft,
      category: categoryDraft,
    });
  };

  return (
    <ResponsiveModal
      open
      onOpenChange={(open) => {
        if (!open) saveAndClose();
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
            saveAndClose();
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
                aria-invalid={!nameValid}
                aria-describedby={!nameValid ? "shopping-name-error" : undefined}
                className="bg-background h-12 rounded-xl font-serif text-xl"
              />
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
                        (category) => category.id === item.product.category,
                      )?.label
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
                disabled={!preferences.isSuccess}
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
            {preferences.isError && (
              <p role="alert" className="text-destructive text-sm">
                Could not load Usually have. Check your connection and try
                again.
              </p>
            )}
            {(edit.isError || deleteProduct.isError) && (
              <p role="alert" className="text-destructive text-sm">
                Could not{" "}
                {deleteProduct.isError ? "delete the product" : "save the item"}.
                Check your connection and try again.
              </p>
            )}
            <div className="pt-1">
              <Button
                type="button"
                variant="outline"
                className="text-destructive hover:bg-destructive/5 hover:text-destructive h-12 w-full rounded-xl px-3"
                onClick={() => deleteProduct.mutate({ id: item.productId })}
              >
                {deleteProduct.isPending ? "Deleting…" : "Delete own item"}
              </Button>
            </div>
          </fieldset>
        </form>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
