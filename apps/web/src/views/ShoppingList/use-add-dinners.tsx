import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { ToastAction } from "~/components/ui/toast";
import { toast } from "~/components/ui/use-toast";
import { api, type RouterInputs } from "~/utils/api";
import type { ShoppingWrites } from "./shopping-writes";

export type DinnerSelection = { id: number; name: string };
type Addition = { operationId: string; dinners: DinnerSelection[] };

export function useAddDinners(
  isCurrent: () => boolean,
  writes: ShoppingWrites,
) {
  const utils = api.useUtils();
  const [pendingDinnerAdditions, setPending] = useState<Addition[]>([]);
  const [failedDinnerAdditions, setFailed] = useState<Addition[]>([]);
  const mutation = useMutation({
    networkMode: "always",
    retry: false,
    meta: { handlesError: true },
    mutationFn: (addition: Addition) =>
      utils.client.shoppingList.addDinners.mutate({
        operationId: addition.operationId,
        dinnerIds: addition.dinners.map(({ id }) => id),
      }),
  });
  const undo = async (input: RouterInputs["shoppingList"]["undo"]) => {
    if (!isCurrent()) return;
    const ticket = writes.reserve(true);
    try {
      await ticket.ready;
      if (!isCurrent()) return;
      await utils.client.shoppingList.undo.mutate(input);
      if (!isCurrent()) return;
      await Promise.all([
        utils.shoppingList.list.invalidate(),
        utils.shoppingList.recent.invalidate(),
        utils.shoppingList.sources.invalidate(),
      ]);
    } catch {
      if (isCurrent())
        toast({
          variant: "destructive",
          title: "Could not undo shopping addition",
        });
    } finally {
      ticket.release();
    }
  };
  const dismissDinnerAddition = (operationId: string) =>
    setFailed((failures) =>
      failures.filter((failure) => failure.operationId !== operationId),
    );
  const submit = (addition: Addition) => {
    if (!isCurrent()) return;
    // Ingredient identities are unknown until the server resolves them. Order
    // shopping writes around this result while later UI drafts remain usable.
    const ticket = writes.reserve(true);
    setPending((pending) => [...pending, addition]);
    dismissDinnerAddition(addition.operationId);
    const notice = toast({ title: "Adding to shopping list…" });
    const save = async () => {
      try {
        await ticket.ready;
        if (!isCurrent()) return;
        const result = await mutation.mutateAsync(addition);
        if (!isCurrent()) return;
        await Promise.all([
          utils.shoppingList.list.cancel(),
          utils.shoppingList.recent.cancel(),
        ]);
        if (!isCurrent()) return;
        utils.shoppingList.list.setData(undefined, result.items);
        utils.shoppingList.recent.setData(undefined, result.recentItems);
        void utils.shoppingList.sources.invalidate();
        void utils.oda.transfer.invalidate();
        toast({
          title: "Added to shopping list",
          action: (
            <ToastAction
              altText="Undo adding to the shopping list"
              onClick={() => void undo(result.undo)}
            >
              Undo
            </ToastAction>
          ),
        });
      } catch {
        if (isCurrent()) {
          setFailed((failures) => [...failures, addition]);
          toast({
            variant: "destructive",
            title: "Could not add dinners",
            description: "Retry from the Shopping List.",
          });
        }
      } finally {
        notice.dismiss();
        if (isCurrent())
          setPending((pending) =>
            pending.filter(
              (entry) => entry.operationId !== addition.operationId,
            ),
          );
        ticket.release();
      }
    };
    void save();
  };
  return {
    addDinners: (dinners: DinnerSelection[]) =>
      submit({ operationId: crypto.randomUUID(), dinners }),
    pendingDinnerAdditions,
    failedDinnerAdditions,
    retryDinnerAddition: submit,
    dismissDinnerAddition,
  };
}
