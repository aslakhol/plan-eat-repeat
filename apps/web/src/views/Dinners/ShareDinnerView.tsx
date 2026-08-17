import { ArrowLeft, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { type DinnerWithRecipe } from "@planeatrepeat/shared";

import { Button } from "~/components/ui/button";
import { toast } from "~/components/ui/use-toast";
import { env } from "~/env";
import {
  publishedDinnerUrl,
  formatPublicationDate,
} from "~/lib/published-dinner";
import { api } from "~/utils/api";

type Publication = {
  publicUrl: string;
  publishedAt: Date;
};

export const ShareDinnerView = ({
  dinner,
  onBack,
}: {
  dinner: DinnerWithRecipe;
  onBack: () => void;
}) => {
  const [publication, setPublication] = useState<Publication | null>(() =>
    dinner.publicSlug && dinner.publishedAt
      ? {
          publishedAt: dinner.publishedAt,
          publicUrl: publishedDinnerUrl(
            dinner.publicSlug,
            env.NEXT_PUBLIC_APP_URL,
          ),
        }
      : null,
  );
  const [canShare, setCanShare] = useState(false);
  const utils = api.useUtils();

  useEffect(() => {
    setCanShare(typeof navigator.share === "function");
  }, []);

  const publishMutation = api.dinner.publish.useMutation({
    onSuccess: async (published) => {
      setPublication(published);
      await utils.dinner.get.invalidate({ dinnerId: dinner.id });
      toast({ title: `${dinner.name} is now public` });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Could not publish dinner",
        description: error.message,
      });
    },
  });
  const stopMutation = api.dinner.stopPublication.useMutation({
    onSuccess: async () => {
      setPublication(null);
      await utils.dinner.get.invalidate({ dinnerId: dinner.id });
      toast({ title: "Sharing stopped" });
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
        <ArrowLeft className="size-3.5" />
        <span className="truncate">{dinner.name}</span>
      </button>

      <h1 className="mt-7 font-serif text-2xl font-normal">Share dinner</h1>

      {publication ? (
        <div className="mt-6 space-y-4">
          <div className="border-border bg-muted flex items-center gap-3 rounded-xl border px-4 py-3">
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
          <p className="text-muted-foreground text-[11.5px] font-semibold">
            Anyone with the link can read this dinner.
          </p>
          {canShare && (
            <Button
              type="button"
              size="lg"
              className="w-full"
              onClick={() => void shareLink()}
            >
              Share…
            </Button>
          )}
          <div className="border-border border-t pt-4">
            <p className="text-[13.5px] font-bold">
              Shared since{" "}
              {formatPublicationDate(publication.publishedAt.toISOString())}
            </p>
          </div>
          <Button
            type="button"
            variant="link"
            className="mx-auto flex h-auto p-0 text-[12.5px] font-bold text-[#a34524] no-underline hover:text-[#a34524] hover:no-underline"
            disabled={stopMutation.isPending}
            onClick={() => stopMutation.mutate({ dinnerId: dinner.id })}
          >
            {stopMutation.isPending ? "Stopping sharing…" : "Stop sharing"}
          </Button>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          <p className="text-muted-foreground text-sm font-semibold">
            Anyone can read this dinner.
          </p>
          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={publishMutation.isPending}
            onClick={() => publishMutation.mutate({ dinnerId: dinner.id })}
          >
            {publishMutation.isPending && <Loader2 className="animate-spin" />}
            Publish dinner
          </Button>
        </div>
      )}
    </section>
  );
};
