import Link from "next/link";
import type { OdaShopping } from "./use-oda-shopping";

const menuItem =
  "hover:bg-muted block w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold disabled:opacity-50";
export function OdaShoppingMenu({
  oda,
  onAction,
}: {
  oda: OdaShopping;
  onAction: () => void;
}) {
  return (
    <div className="border-border mt-1 border-t pt-1">
      {oda.status.data?.connected && !oda.status.data.reconnectRequired ? (
        <>
          {oda.transfer.isError && (
            <>
              <p className="px-3 py-2 text-xs text-stone-600" role="alert">
                Could not load Oda transfer status.
              </p>
              <button
                type="button"
                className={menuItem}
                onClick={() => void oda.transfer.refetch()}
              >
                Retry transfer status
              </button>
            </>
          )}
          <button
            type="button"
            className={menuItem}
            disabled={oda.sendDisabled}
            onClick={() => {
              onAction();
              oda.send();
            }}
          >
            Send to Oda
          </button>
          {oda.cartUrl ? (
            <a
              className={menuItem}
              href={oda.cartUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onAction}
            >
              Open Oda cart
            </a>
          ) : (
            <button
              type="button"
              className={menuItem}
              disabled={oda.cart.isFetching}
              onClick={() => void oda.cart.refetch()}
            >
              {oda.cart.isError ? "Retry Oda cart" : "Open Oda cart"}
            </button>
          )}
          <Link className={menuItem} href="/settings" onClick={onAction}>
            Oda settings
          </Link>
        </>
      ) : (
        <button
          type="button"
          className={menuItem}
          disabled={
            oda.status.isPending || oda.status.isError || oda.connect.isPending
          }
          onClick={() => {
            onAction();
            oda.connect.mutate();
          }}
        >
          {oda.status.data?.reconnectRequired ? "Reconnect Oda" : "Connect Oda"}
        </button>
      )}
      {oda.status.isError && (
        <button
          type="button"
          className={menuItem}
          onClick={() => void oda.status.refetch()}
        >
          Retry Oda connection
        </button>
      )}
    </div>
  );
}
