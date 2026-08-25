import { ChevronLeft } from "lucide-react";
import { useEffect, useState } from "react";

import { type DinnerWithRecipe } from "@planeatrepeat/shared";

import { Button } from "~/components/ui/button";
import { toast } from "~/components/ui/use-toast";
import { env } from "~/env";
import { publishedDinnerUrl } from "~/lib/published-dinner";
import { api } from "~/utils/api";

type Publication = {
  publicUrl: string;
};

export const ShareDinnerView = ({
  dinner,
  onBack,
}: {
  dinner: DinnerWithRecipe;
  onBack: () => void;
}) => {
  const publication: Publication | null =
    dinner.publicSlug && dinner.publishedAt
      ? {
          publicUrl: publishedDinnerUrl(
            dinner.publicSlug,
            env.NEXT_PUBLIC_APP_URL,
          ),
        }
      : null;
  const [canShare, setCanShare] = useState(false);
  const utils = api.useUtils();
  const saveCountQuery = api.dinner.publishedSaveCount.useQuery(
    { dinnerId: dinner.id },
    { enabled: publication !== null },
  );
  const saveCount = saveCountQuery.data?.saveCount ?? 0;

  useEffect(() => {
    setCanShare(typeof navigator.share === "function");
  }, []);

  const stopMutation = api.dinner.stopPublication.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.dinner.get.invalidate({ dinnerId: dinner.id }),
        utils.dinner.summaries.invalidate(),
        utils.dinner.sharedDinners.invalidate(),
      ]);
      toast({ title: "Sharing stopped" });
      onBack();
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Could not stop sharing",
        description: error.message,
      });
    },
  });

  const copyLink = async () => {
    if (!publication) return;
    try {
      await navigator.clipboard.writeText(publication.publicUrl);
      toast({ title: "Copied link" });
    } catch {
      toast({ variant: "destructive", title: "Could not copy link" });
    }
  };

  const shareLink = async () => {
    if (!publication || !navigator.share) return;
    try {
      await navigator.share({
        title: dinner.name,
        url: publication.publicUrl,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast({ variant: "destructive", title: "Could not share Dinner" });
    }
  };

  return (
    <section className="mx-auto w-full max-w-[640px] px-1 pb-2">
      <button
        type="button"
        className="text-muted-foreground inline-flex items-center gap-1 text-[12.5px] font-bold"
        onClick={onBack}
      >
        <ChevronLeft className="size-3.5" />
        <span className="truncate">{dinner.name}</span>
      </button>

      <h1 className="mt-7 font-serif text-3xl font-normal">Sharing</h1>

      {publication && (
        <div>
          {saveCount > 0 && (
            <p className="text-muted-foreground mt-1 text-[13.5px] font-semibold">
              Saved by {saveCount} {saveCount === 1 ? "person" : "people"}
            </p>
          )}

          <div className="border-border bg-muted mt-5 flex items-center gap-3 rounded-xl border px-4 py-3">
            <span className="min-w-0 flex-1 truncate text-xs font-semibold">
              {publication.publicUrl}
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

          <div
            className={
              canShare ? "mt-3 grid grid-cols-2 gap-2" : "mt-3 grid gap-2"
            }
          >
            {canShare && (
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="bg-white"
                onClick={() => void shareLink()}
              >
                Share…
              </Button>
            )}
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="bg-white text-[#a34524] hover:text-[#a34524]"
              disabled={stopMutation.isPending}
              onClick={() => stopMutation.mutate({ dinnerId: dinner.id })}
            >
              {stopMutation.isPending ? "Stopping…" : "Stop sharing"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
};
