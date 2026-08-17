import { ArrowLeft, ExternalLink, Loader2 } from "lucide-react";
import { useState } from "react";

import { type DinnerWithRecipe } from "@planeatrepeat/shared";

import { Button } from "~/components/ui/button";
import { toast } from "~/components/ui/use-toast";
import { env } from "~/env";
import {
  publishedDinnerPath,
  publishedDinnerUrl,
} from "~/lib/published-dinner";
import { api } from "~/utils/api";

type Publication = {
  publicSlug: string;
  publicUrl: string;
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
          publicSlug: dinner.publicSlug,
          publicUrl: publishedDinnerUrl(
            dinner.publicSlug,
            env.NEXT_PUBLIC_APP_URL,
          ),
        }
      : null,
  );
  const utils = api.useUtils();
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
          </div>
          <p className="text-muted-foreground text-[11.5px] font-semibold">
            Anyone can read this dinner.
          </p>
          <Button asChild size="lg" className="w-full">
            <a
              href={publishedDinnerPath(publication.publicSlug)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open published dinner
              <ExternalLink />
            </a>
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
