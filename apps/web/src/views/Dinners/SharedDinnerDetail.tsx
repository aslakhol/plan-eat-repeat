import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

import { Button } from "~/components/ui/button";
import { toast } from "~/components/ui/use-toast";
import { env } from "~/env";
import { publishedDinnerUrl } from "~/lib/published-dinner";
import { formatSharedDinnerMeta } from "~/lib/shared-dinners";
import { api } from "~/utils/api";

const displayPublicUrl = (publicUrl: string) =>
  publicUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");

export const SharedDinnerDetail = () => {
  const router = useRouter();
  const utils = api.useUtils();
  const unavailableHandled = useRef(false);
  const rawDinnerId = router.query.dinnerId;
  const dinnerId =
    typeof rawDinnerId === "string" ? Number(rawDinnerId) : Number.NaN;
  const validDinnerId = Number.isInteger(dinnerId);
  const sharedDinnersQuery = api.dinner.sharedDinners.useQuery();
  const dinner = sharedDinnersQuery.data?.dinners.find(
    (candidate) => candidate.id === dinnerId,
  );

  useEffect(() => {
    if (
      unavailableHandled.current ||
      !router.isReady ||
      (validDinnerId && !sharedDinnersQuery.isSuccess) ||
      dinner
    ) {
      return;
    }

    unavailableHandled.current = true;
    toast({ title: "This dinner is no longer shared" });
    void router.replace("/dinners/shared");
  }, [dinner, router, sharedDinnersQuery.isSuccess, validDinnerId]);

  const stopMutation = api.dinner.stopPublication.useMutation({
    onSuccess: async () => {
      if (!dinner) return;
      unavailableHandled.current = true;
      utils.dinner.sharedDinners.setData(undefined, (current) => {
        if (!current) return current;
        const dinners = current.dinners.filter(
          (candidate) => candidate.id !== dinner.id,
        );
        return {
          ...current,
          dinners,
          publicDinnerList:
            dinners.length > 0 ? current.publicDinnerList : null,
        };
      });
      toast({ title: `${dinner.name} is no longer shared` });
      await router.replace("/dinners/shared");
      await Promise.all([
        utils.dinner.sharedDinners.invalidate(),
        utils.dinner.summaries.invalidate(),
        utils.dinner.get.invalidate({ dinnerId: dinner.id }),
      ]);
    },
    onError: async (error) => {
      if (error.data?.code === "NOT_FOUND") {
        toast({ title: "This dinner is no longer shared" });
        await router.replace("/dinners/shared");
        await Promise.all([
          utils.dinner.sharedDinners.invalidate(),
          utils.dinner.summaries.invalidate(),
        ]);
        return;
      }

      toast({
        variant: "destructive",
        title: "Couldn't stop sharing",
        description: error.message,
      });
    },
  });

  if (sharedDinnersQuery.isError) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-3 px-4 text-center">
        <AlertCircle className="text-destructive size-6" />
        <p className="font-serif text-xl">Couldn&apos;t load this dinner</p>
        <Button
          type="button"
          variant="ghost"
          className="text-primary font-bold"
          onClick={() => void sharedDinnersQuery.refetch()}
        >
          Try again
        </Button>
      </div>
    );
  }

  if (!dinner) {
    return (
      <div className="flex min-h-48 items-center justify-center">
        <Loader2 className="text-primary animate-spin" />
      </div>
    );
  }

  const publicUrl = publishedDinnerUrl(
    dinner.publicSlug,
    env.NEXT_PUBLIC_APP_URL,
  );

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast({ title: "Copied link" });
    } catch {
      toast({ variant: "destructive", title: "Could not copy link" });
    }
  };

  return (
    <section className="mx-auto w-full max-w-[640px] px-1 pb-2">
      <p className="text-muted-foreground text-[13px] font-semibold">
        {formatSharedDinnerMeta(dinner)}
      </p>
      <h1 className="mt-1 font-serif text-[26px] font-normal leading-tight">
        {dinner.name}
      </h1>

      <div className="border-border bg-muted mt-6 flex items-center gap-3 rounded-xl border px-4 py-3">
        <span className="min-w-0 flex-1 truncate text-xs font-semibold">
          {displayPublicUrl(publicUrl)}
        </span>
        <Button
          type="button"
          variant="link"
          className="h-auto p-0 text-xs font-bold no-underline hover:no-underline"
          onClick={() => void copyLink()}
        >
          Copy
        </Button>
      </div>

      <div className="border-border mt-5 overflow-hidden rounded-xl border">
        <a
          href={publicUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:bg-muted flex min-h-12 items-center justify-between gap-3 px-4 py-3 text-sm font-semibold"
        >
          Open public page
        </a>
        <Link
          href={`/dinners/${dinner.id}`}
          className="hover:bg-muted flex min-h-12 items-center border-t px-4 py-3 text-sm font-semibold"
        >
          Open dinner
        </Link>
        <button
          type="button"
          disabled={stopMutation.isPending}
          className="text-destructive hover:bg-destructive/5 flex min-h-12 w-full items-center border-t px-4 py-3 text-left text-sm font-semibold disabled:opacity-50"
          onClick={() => stopMutation.mutate({ dinnerId: dinner.id })}
        >
          {stopMutation.isPending ? "Stopping…" : "Stop sharing"}
        </button>
      </div>
    </section>
  );
};
