import { useRouter } from "next/router";
import Link from "next/link";
import { api } from "~/utils/api";
import { Button } from "~/components/ui/button";
import { toast } from "~/components/ui/use-toast";

export function OdaConnection({ settings = false }: { settings?: boolean }) {
  const router = useRouter();
  const utils = api.useUtils();
  const status = api.oda.status.useQuery();
  const connect = api.oda.connect.useMutation({
    onSuccess: ({ url }) => window.location.assign(url),
    onError: (error) => toast({ title: error.message, variant: "destructive" }),
  });
  const disconnect = api.oda.disconnect.useMutation({
    onSuccess: () => utils.oda.invalidate(),
    onError: (error) => toast({ title: error.message, variant: "destructive" }),
  });
  const cart = api.oda.cart.useQuery(undefined, {
    enabled: !!status.data?.connected && !status.data.reconnectRequired,
    retry: false,
  });
  return (
    <div className="my-3 space-y-2">
      {router.query.oda === "failed" && (
        <p role="alert" className="text-destructive text-sm">
          Oda login failed. Connect again in{" "}
          <Link href="/settings">settings</Link>.
        </p>
      )}
      {settings && (
        <p className="text-sm">
          Oda:{" "}
          {status.isPending
            ? "Loading…"
            : status.data?.reconnectRequired
              ? "Reconnect required"
              : status.data?.connected
                ? "Connected"
                : "Not connected"}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {settings ? (
          <>
            <Button
              variant="outline"
              disabled={
                status.isPending || connect.isPending || disconnect.isPending
              }
              onClick={() => connect.mutate()}
            >
              {status.data?.connected ? "Reconnect Oda" : "Connect Oda"}
            </Button>
            {status.data?.connected && (
              <Button
                variant="outline"
                disabled={disconnect.isPending || connect.isPending}
                onClick={() => disconnect.mutate()}
              >
                Disconnect Oda
              </Button>
            )}
          </>
        ) : (
          (!status.data?.connected || status.data.reconnectRequired) && (
            <Button asChild variant="outline">
              <Link href="/settings">
                {status.data?.reconnectRequired
                  ? "Reconnect Oda"
                  : "Connect Oda"}
              </Link>
            </Button>
          )
        )}
        {cart.data && (
          <Button asChild variant="outline">
            <a href={cart.data.url} target="_blank" rel="noopener noreferrer">
              Open Oda cart
            </a>
          </Button>
        )}
      </div>
      {cart.error && (
        <p role="alert" className="text-destructive text-sm">
          {cart.error.message}
        </p>
      )}
    </div>
  );
}
