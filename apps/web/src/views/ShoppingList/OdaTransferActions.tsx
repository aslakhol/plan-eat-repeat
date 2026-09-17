import { useRef } from "react";
import { useIsMutating } from "@tanstack/react-query";
import { UtensilsCrossed } from "lucide-react";
import { api, type RouterOutputs } from "~/utils/api";
import { Button } from "~/components/ui/button";

export function OdaTransferActions({ disabled }: { disabled: boolean }) {
  const utils = api.useUtils();
  const requestId = useRef<string | null>(null);
  const pendingChanges = useIsMutating({ mutationKey: [["shoppingList"]] });
  const transfer = api.oda.transfer.useQuery(undefined, {
    refetchInterval: 2000,
  });
  const onSuccess = async (result: RouterOutputs["oda"]["send"]) => {
    utils.oda.transfer.setData(undefined, result);
    requestId.current = null;
    await Promise.all([
      utils.shoppingList.invalidate(),
      utils.oda.cart.invalidate(),
      utils.oda.status.invalidate(),
    ]);
  };
  const send = api.oda.send.useMutation({
    retry: false,
    onSuccess,
    onError: () => utils.oda.transfer.invalidate(),
  });
  const recover = api.oda.recover.useMutation({
    retry: false,
    onSuccess,
    onError: () => utils.oda.transfer.invalidate(),
  });
  const resolve = api.oda.resolve.useMutation({
    retry: false,
    onSuccess,
    onError: () => utils.oda.transfer.invalidate(),
  });
  const active =
    !transfer.data?.recoverable &&
    (transfer.data?.state === "MATCHING" || transfer.data?.state === "SENDING");
  const blocked = !!transfer.data && transfer.data.state !== "COMPLETED";
  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        disabled={
          disabled ||
          pendingChanges > 0 ||
          transfer.isPending ||
          transfer.isError ||
          recover.isPending ||
          resolve.isPending ||
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
      {transfer.data?.recoverable && (
        <Button
          variant="outline"
          disabled={
            recover.isPending ||
            resolve.isPending ||
            send.isPending ||
            pendingChanges > 0
          }
          onClick={() => recover.mutate({ id: transfer.data!.id })}
        >
          {recover.isPending ? "Recovering…" : "Recover transfer"}
        </Button>
      )}
      {transfer.data?.message && (
        <p role="status" className="text-sm">
          {transfer.data.message}
        </p>
      )}
      {transfer.data?.state === "UNCERTAIN" && transfer.data.recoverable && (
        <div className="space-y-2">
          <p className="text-sm">
            After checking the uncertain additions in Oda:
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={
                resolve.isPending ||
                recover.isPending ||
                send.isPending ||
                pendingChanges > 0
              }
              onClick={() =>
                resolve.mutate({ id: transfer.data!.id, outcome: "ADDED" })
              }
            >
              Mark as added
            </Button>
            <Button
              variant="outline"
              disabled={
                resolve.isPending ||
                recover.isPending ||
                send.isPending ||
                pendingChanges > 0
              }
              onClick={() =>
                resolve.mutate({ id: transfer.data!.id, outcome: "NOT_ADDED" })
              }
            >
              Mark as not added
            </Button>
          </div>
        </div>
      )}
      {(send.error ?? recover.error ?? resolve.error ?? transfer.error) && (
        <p role="alert" className="text-destructive text-sm">
          Could not finish sending. Check the Oda cart before trying again.
        </p>
      )}
    </div>
  );
}
