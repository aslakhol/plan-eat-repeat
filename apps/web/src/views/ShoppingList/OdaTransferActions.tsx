import { useRef } from "react";
import { useIsMutating } from "@tanstack/react-query";
import { UtensilsCrossed } from "lucide-react";
import { api } from "~/utils/api";
import { Button } from "~/components/ui/button";

export function OdaTransferActions({ disabled }: { disabled: boolean }) {
  const utils = api.useUtils();
  const requestId = useRef<string | null>(null);
  const pendingChanges = useIsMutating({ mutationKey: [["shoppingList"]] });
  const transfer = api.oda.transfer.useQuery(undefined, {
    refetchInterval: 2000,
  });
  const send = api.oda.send.useMutation({
    retry: false,
    onSuccess: async (result) => {
      utils.oda.transfer.setData(undefined, result);
      requestId.current = null;
      await Promise.all([
        utils.shoppingList.invalidate(),
        utils.oda.cart.invalidate(),
        utils.oda.status.invalidate(),
      ]);
    },
    onError: () => utils.oda.transfer.invalidate(),
  });
  const active =
    transfer.data?.state === "MATCHING" || transfer.data?.state === "SENDING";
  const blocked = transfer.data?.state === "UNCERTAIN";
  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        disabled={
          disabled ||
          pendingChanges > 0 ||
          transfer.isPending ||
          active ||
          blocked ||
          send.isPending
        }
        onClick={() => {
          requestId.current ??= crypto.randomUUID();
          send.mutate({ id: requestId.current });
        }}
      >
        {(active || send.isPending) && (
          <UtensilsCrossed
            aria-hidden="true"
            className="mr-2 size-4 animate-spin"
          />
        )}
        {active || send.isPending ? "Sending to Oda…" : "Send to Oda"}
      </Button>
      {transfer.data?.message && (
        <p role="status" className="text-sm">
          {transfer.data.message}
        </p>
      )}
      {send.error && (
        <p role="alert" className="text-destructive text-sm">
          Could not finish sending. Check the Oda cart before trying again.
        </p>
      )}
    </div>
  );
}
