import { api } from "~/utils/api";
import { Button } from "~/components/ui/button";
import { toast } from "~/components/ui/use-toast";

export function OdaConnection() {
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
  return (
    <div className="my-3 space-y-2">
      <p className="text-sm">
        Oda:{" "}
        {status.isPending
          ? "Loading…"
          : status.isError
            ? "Unavailable"
            : status.data?.reconnectRequired
              ? "Reconnect required"
              : status.data?.connected
                ? "Connected"
                : "Not connected"}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={
            status.isPending ||
            status.isError ||
            connect.isPending ||
            disconnect.isPending
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
      </div>
    </div>
  );
}
