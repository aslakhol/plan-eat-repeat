import { useState } from "react";
import { useRouter } from "next/router";
import { usePostHog } from "posthog-js/react";
import { ChefHat, Link2, Loader2 } from "lucide-react";
import type { RecipeDraft } from "@planeatrepeat/shared";
import { toast } from "../../components/ui/use-toast";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { api } from "../../utils/api";
import {
  RecipeEditor,
  dinnerFromEditorValues,
  type RecipeEditorValues,
} from "./RecipeEditor";

export const CreateDinner = () => {
  const [mode, setMode] = useState<"choose" | "manual" | "link" | "draft">(
    "choose",
  );
  const [url, setUrl] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [draft, setDraft] = useState<RecipeDraft>();
  const router = useRouter();
  const posthog = usePostHog();
  const utils = api.useUtils();

  const createMutation = api.dinner.create.useMutation({
    onSuccess: async (result) => {
      toast({ title: `${result.dinner.name} created` });
      await Promise.all([
        utils.dinner.dinners.invalidate(),
        utils.dinner.tags.invalidate(),
        utils.dinner.ingredientNames.invalidate(),
      ]);
      void router.push(`/dinners/${result.dinner.id}`);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Could not create dinner",
        description: error.message,
      });
    },
  });

  const createDinner = (values: RecipeEditorValues) => {
    posthog.capture("create new dinner", { dinnerName: values.name });
    createMutation.mutate(dinnerFromEditorValues(values));
  };

  const importFromUrl = api.dinner.importFromUrl.useMutation({
    onSuccess: (result) => {
      setDraft(result);
      setMode("draft");
    },
  });
  const importFromText = api.dinner.importFromText.useMutation({
    onSuccess: (result) => {
      setDraft({ ...result, sourceUrl: url.trim() || undefined });
      setMode("draft");
    },
  });

  const importError = importFromUrl.error ?? importFromText.error;
  const showPasteFallback =
    !!importFromUrl.error &&
    ["FETCH_FAILED", "NO_RECIPE_FOUND"].includes(
      importFromUrl.error.data?.importErrorCode ?? "",
    );

  if (mode === "manual" || (mode === "draft" && draft)) {
    return (
      <RecipeEditor
        key={mode}
        draft={draft}
        isPending={createMutation.isPending}
        onCancel={() => {
          setDraft(undefined);
          setMode("choose");
        }}
        onSave={createDinner}
      />
    );
  }

  if (mode === "link") {
    const isYouTube = /(?:youtube\.com|youtu\.be)/i.test(url);
    const isPending = importFromUrl.isPending || importFromText.isPending;

    return (
      <div className="mx-auto w-full max-w-[640px] space-y-5 py-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => setMode("choose")}>
            Cancel
          </Button>
          <h1 className="font-serif text-lg">Import recipe</h1>
          <div className="w-16" />
        </div>

        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-1.5">
              <label htmlFor="recipe-url" className="text-sm font-semibold">
                Recipe link
              </label>
              <Input
                id="recipe-url"
                type="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://…"
                disabled={isPending}
              />
            </div>
            <Button
              className="w-full"
              disabled={!url.trim() || isPending}
              onClick={() => importFromUrl.mutate({ url: url.trim() })}
            >
              {importFromUrl.isPending && <Loader2 className="animate-spin" />}
              {importFromUrl.isPending
                ? isYouTube
                  ? "Reading the video description and captions…"
                  : "Reading and structuring the recipe…"
                : "Import from link"}
            </Button>

            {importError && (
              <p className="text-destructive text-sm">{importError.message}</p>
            )}

            {showPasteFallback && (
              <div className="space-y-3 border-t pt-4">
                <div>
                  <p className="text-sm font-semibold">
                    Paste the recipe instead
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Some sites block automatic reading. Copy the ingredients and
                    method from the page.
                  </p>
                </div>
                <Textarea
                  value={pastedText}
                  onChange={(event) => setPastedText(event.target.value)}
                  placeholder="Paste ingredients and instructions"
                  className="min-h-40"
                  disabled={isPending}
                />
                <Button
                  variant="secondary"
                  className="w-full"
                  disabled={pastedText.trim().length < 50 || isPending}
                  onClick={() =>
                    importFromText.mutate({ text: pastedText.trim() })
                  }
                >
                  {importFromText.isPending && (
                    <Loader2 className="animate-spin" />
                  )}
                  Structure pasted recipe
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[640px] space-y-5 py-6">
      <div>
        <h1 className="font-serif text-3xl">New dinner</h1>
        <p className="text-muted-foreground mt-1">
          Start from a recipe or build one yourself.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          className="focus-visible:ring-ring rounded-lg text-left focus-visible:outline-none focus-visible:ring-2"
          onClick={() => setMode("link")}
        >
          <Card className="hover:border-primary h-full transition-colors">
            <CardContent className="flex h-full items-start gap-3 p-5">
              <Link2 className="text-primary mt-0.5" />
              <div>
                <p className="font-semibold">Import from link</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  Recipe sites and YouTube videos
                </p>
              </div>
            </CardContent>
          </Card>
        </button>
        <button
          type="button"
          className="focus-visible:ring-ring rounded-lg text-left focus-visible:outline-none focus-visible:ring-2"
          onClick={() => setMode("manual")}
        >
          <Card className="hover:border-primary h-full transition-colors">
            <CardContent className="flex h-full items-start gap-3 p-5">
              <ChefHat className="text-primary mt-0.5" />
              <div>
                <p className="font-semibold">Create manually</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  Add the recipe details yourself
                </p>
              </div>
            </CardContent>
          </Card>
        </button>
      </div>
      <Button variant="ghost" onClick={() => void router.push("/dinners")}>
        Cancel
      </Button>
    </div>
  );
};
