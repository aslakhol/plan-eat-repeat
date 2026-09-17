import { useState } from "react";
import { useIsMutating } from "@tanstack/react-query";
import { api } from "~/utils/api";
import { toast } from "~/components/ui/use-toast";

type Item = { id: string; name: string };
export function useOdaShopping(
  items: Item[],
  menuOpen: boolean,
  disabled: boolean,
) {
  const utils = api.useUtils();
  const [request, setRequest] = useState<{
    id: string;
    startedAt: Date;
    items: Item[];
  } | null>(null);
  const pendingChanges = useIsMutating({ mutationKey: [["shoppingList"]] });
  const status = api.oda.status.useQuery();
  const transfer = api.oda.transfer.useQuery(undefined, {
    refetchInterval: 2000,
  });
  const cart = api.oda.cart.useQuery(undefined, {
    enabled:
      menuOpen && !!status.data?.connected && !status.data.reconnectRequired,
    staleTime: 60_000,
    retry: false,
  });
  const connect = api.oda.connect.useMutation({
    onSuccess: ({ url }) => window.location.assign(url),
    onError: (error) => toast({ title: error.message, variant: "destructive" }),
  });
  const onSuccess = async () => {
    await Promise.all([
      utils.oda.transfer.invalidate(),
      utils.shoppingList.invalidate(),
      utils.oda.cart.invalidate(),
      utils.oda.status.invalidate(),
    ]);
    setRequest(null);
  };
  const onError = async (error: { message: string }) => {
    toast({ title: error.message, variant: "destructive" });
    await utils.oda.transfer.invalidate();
  };
  const send = api.oda.send.useMutation({ retry: false, onSuccess, onError });
  const recover = api.oda.recover.useMutation({
    retry: false,
    onSuccess,
    onError,
  });
  const resolve = api.oda.resolve.useMutation({
    retry: false,
    onSuccess,
    onError,
  });
  const dismissResult = api.oda.dismiss.useMutation({
    onSuccess: () => utils.oda.transfer.invalidate(),
    onError: (error) => toast({ title: error.message, variant: "destructive" }),
  });
  const progress =
    send.isPending && request && transfer.data?.id !== request.id
      ? {
          ...request,
          state: "MATCHING" as const,
          stage: "CHECKING_CART" as const,
          items: request.items.map((item) => ({
            ...item,
            state: "WAITING" as const,
          })),
          finishedAt: null,
          message: null,
          cartUrl: null,
          recoverable: false,
          confirmedProducts: 0,
          totalProducts: 0,
        }
      : transfer.data;
  const busy = send.isPending || recover.isPending || resolve.isPending;
  return {
    status,
    transfer,
    cart,
    connect,
    recover,
    resolve,
    progress,
    dismissDisabled: dismissResult.isPending,
    busy,
    recoveryDisabled: busy || pendingChanges > 0,
    sendDisabled:
      disabled ||
      !items.length ||
      pendingChanges > 0 ||
      busy ||
      status.isPending ||
      status.isError ||
      !status.data?.connected ||
      status.data.reconnectRequired ||
      transfer.isPending ||
      transfer.isError ||
      (!!transfer.data && transfer.data.state !== "COMPLETED"),
    cartUrl: cart.data?.url ?? transfer.data?.cartUrl,
    send() {
      const next =
        request && request.id !== transfer.data?.id
          ? request
          : {
              id: crypto.randomUUID(),
              startedAt: new Date(),
              items,
            };
      setRequest(next);
      send.mutate({ id: next.id });
    },
    dismiss() {
      if (progress?.state === "COMPLETED")
        dismissResult.mutate({ id: progress.id });
    },
  };
}
export type OdaShopping = ReturnType<typeof useOdaShopping>;
