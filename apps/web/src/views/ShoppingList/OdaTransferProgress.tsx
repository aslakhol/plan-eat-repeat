import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { X } from "lucide-react";
import type { RouterOutputs } from "~/utils/api";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import type { OdaShopping } from "./use-oda-shopping";

type Transfer = NonNullable<RouterOutputs["oda"]["transfer"]>;
const appearance = {
  WAITING: "border-stone-300 bg-transparent",
  MATCHING: "border-amber-300 bg-amber-200/70 motion-safe:animate-pulse",
  READY: "border-sky-200 bg-sky-100",
  ADDING: "border-sky-500 bg-sky-400 motion-safe:animate-pulse",
  CONFIRMED: "border-emerald-600 bg-emerald-500",
  UNRESOLVED: "border-rose-500 bg-rose-400",
  UNCERTAIN: "border-amber-500 bg-amber-400",
} satisfies Record<Transfer["items"][number]["state"], string>;
const stages = {
  CHECKING_CART: "Checking your Oda cart",
  FINDING_PRODUCTS: "Finding products",
  CHOOSING_PRODUCTS: "Choosing products and quantities",
  ADDING_TO_CART: "Adding to your Oda cart",
  UPDATING_LIST: "Updating your shopping list",
} satisfies Record<Transfer["stage"], string>;

function Elapsed({
  startedAt,
  finishedAt,
}: Pick<Transfer, "startedAt" | "finishedAt">) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (finishedAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [finishedAt]);
  const seconds = Math.max(
    0,
    Math.floor(((finishedAt?.getTime() ?? now) - startedAt.getTime()) / 1000),
  );
  return (
    <span
      className="shrink-0 text-[11px] tabular-nums text-stone-400"
      aria-label={`${seconds} seconds elapsed`}
    >
      {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
    </span>
  );
}

export function OdaTransferProgress({ oda }: { oda: OdaShopping }) {
  const router = useRouter();
  const transfer = oda.progress;
  const finished = transfer?.state === "COMPLETED";
  const recent =
    !!transfer?.finishedAt &&
    Date.now() - transfer.finishedAt.getTime() < 5 * 60_000;
  const visible =
    transfer && (!finished || (recent && oda.dismissedId !== transfer.id));
  const covered =
    transfer?.items.filter((item) => item.state === "CONFIRMED").length ?? 0;
  const remaining = (transfer?.items.length ?? 0) - covered;
  const title = !transfer
    ? ""
    : finished
      ? `${covered} ${covered === 1 ? "item" : "items"} ready in Oda${remaining ? ` · ${remaining} unresolved` : ""}`
      : transfer.recoverable
        ? "Oda transfer needs attention"
        : transfer.stage === "ADDING_TO_CART"
          ? `${transfer.confirmedProducts} of ${transfer.totalProducts} products ready in Oda`
          : stages[transfer.stage];
  const feedback =
    router.query.oda === "connected"
      ? "Oda connected"
      : router.query.oda === "failed"
        ? "Could not connect to Oda. Try again from the list menu."
        : null;
  return (
    <>
      {feedback && (
        <div
          className="mb-4 flex items-center justify-between gap-2 text-sm"
          role="status"
        >
          {feedback}
          <Button
            size="icon"
            variant="ghost"
            className="size-8 shrink-0"
            aria-label="Dismiss Oda connection message"
            onClick={() => {
              const { oda: _oda, ...query } = router.query;
              void router.replace(
                { pathname: router.pathname, query },
                undefined,
                { shallow: true },
              );
            }}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      )}
      {oda.connect.isPending && (
        <p className="mb-4 text-sm text-stone-600" role="status">
          Connecting to Oda…
        </p>
      )}
      {visible && (
        <section className="mb-5" aria-label="Oda transfer progress">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-[13px] font-medium text-stone-600" role="status">
              {title}
            </p>
            <div className="flex shrink-0 items-center gap-1">
              {(!transfer.recoverable || finished) && (
                <Elapsed
                  key={transfer.id}
                  startedAt={transfer.startedAt}
                  finishedAt={transfer.finishedAt}
                />
              )}
              {finished && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  aria-label="Dismiss Oda result"
                  onClick={oda.dismiss}
                >
                  <X className="size-3.5" />
                </Button>
              )}
            </div>
          </div>
          <div className="flex max-w-sm flex-wrap gap-1" aria-hidden="true">
            {transfer.items.map((item, index) => (
              <span
                key={item.id}
                className={cn(
                  "size-3.5 rounded-[3px] border transition-colors duration-500 motion-reduce:transition-none",
                  appearance[item.state],
                  transfer.recoverable && "motion-safe:animate-none",
                )}
                style={
                  item.state === "MATCHING" && !transfer.recoverable
                    ? { animationDelay: `${index * 90}ms` }
                    : undefined
                }
              />
            ))}
          </div>
          {transfer.message &&
            (transfer.state === "UNCERTAIN" || covered === 0) && (
              <p className="mt-2 text-xs text-stone-600" role="status">
                {transfer.message}
              </p>
            )}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
            {transfer.cartUrl && (finished || transfer.recoverable) && (
              <a
                href={transfer.cartUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-9 items-center font-semibold underline underline-offset-4"
              >
                Open Oda cart
              </a>
            )}
            {transfer.recoverable && (
              <button
                type="button"
                className="min-h-9 font-semibold underline underline-offset-4 disabled:opacity-50"
                disabled={oda.recoveryDisabled}
                onClick={() => oda.recover.mutate({ id: transfer.id })}
              >
                {oda.recover.isPending ? "Recovering…" : "Recover transfer"}
              </button>
            )}
            {transfer.state === "UNCERTAIN" && transfer.recoverable && (
              <>
                <span className="basis-full text-stone-500">
                  After checking the uncertain addition in Oda:
                </span>
                <button
                  type="button"
                  className="min-h-9 font-semibold underline underline-offset-4 disabled:opacity-50"
                  disabled={oda.recoveryDisabled}
                  onClick={() =>
                    oda.resolve.mutate({ id: transfer.id, outcome: "ADDED" })
                  }
                >
                  Mark as added
                </button>
                <button
                  type="button"
                  className="min-h-9 font-semibold underline underline-offset-4 disabled:opacity-50"
                  disabled={oda.recoveryDisabled}
                  onClick={() =>
                    oda.resolve.mutate({
                      id: transfer.id,
                      outcome: "NOT_ADDED",
                    })
                  }
                >
                  Mark as not added
                </button>
              </>
            )}
          </div>
        </section>
      )}
    </>
  );
}
