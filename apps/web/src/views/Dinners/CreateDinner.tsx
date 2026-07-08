import { type FormEvent, type ReactNode, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { usePostHog } from "posthog-js/react";
import { Loader2, LinkIcon, Pencil, Wand2 } from "lucide-react";
import { z } from "zod";
import { toast } from "../../components/ui/use-toast";
import { api } from "../../utils/api";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import {
  RecipeEditor,
  dinnerFromEditorValues,
  editorValuesFromRecipeInput,
  type RecipeEditorValues,
} from "./RecipeEditor";

type ImportErrorCode = "FETCH_FAILED" | "NO_RECIPE_FOUND" | "EXTRACTION_FAILED";

type CreateMode = "choose" | "manual" | "import" | "draft";

const loadingCopy = [
  "Fetching the page",
  "Looking for structured recipe data",
  "Normalizing ingredients and steps",
];

const urlSchema = z.string().url();

export const CreateDinner = () => {
  const router = useRouter();
  const posthog = usePostHog();
  const utils = api.useUtils();
  const [mode, setMode] = useState<CreateMode>("choose");
  const [url, setUrl] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [importError, setImportError] = useState<ImportErrorCode | null>(null);
  const [showPasteFallback, setShowPasteFallback] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [draft, setDraft] = useState<RecipeEditorValues | null>(null);
  const draftKey = useMemo(
    () => (draft ? `${draft.name}-${draft.link}` : "manual"),
    [draft],
  );

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

  const importFromUrlMutation = api.dinner.importFromUrl.useMutation({
    onMutate: () => {
      setImportError(null);
      setLoadingStep(0);
      const interval = window.setInterval(() => {
        setLoadingStep((current) =>
          Math.min(current + 1, loadingCopy.length - 1),
        );
      }, 3_000);

      return { interval };
    },
    onSuccess: (result) => {
      setDraft(
        editorValuesFromRecipeInput({
          name: result.name,
          recipe: result.recipe,
          link: result.sourceUrl,
        }),
      );
      setMode("draft");
    },
    onError: (error) => {
      const code = importErrorCode(error.message);
      setImportError(code);
      if (code === "FETCH_FAILED" || code === "NO_RECIPE_FOUND") {
        setShowPasteFallback(true);
      }
    },
    onSettled: (_data, _error, _variables, context) => {
      if (context?.interval) {
        window.clearInterval(context.interval);
      }
    },
  });

  const importFromTextMutation = api.dinner.importFromText.useMutation({
    onMutate: () => {
      setImportError(null);
      setLoadingStep(loadingCopy.length - 1);
    },
    onSuccess: (result) => {
      const sourceUrl = urlSchema.safeParse(url.trim()).success
        ? url.trim()
        : null;
      setDraft(
        editorValuesFromRecipeInput({
          name: result.name,
          recipe: result.recipe,
          link: sourceUrl,
        }),
      );
      setMode("draft");
    },
    onError: (error) => {
      setImportError(importErrorCode(error.message));
    },
  });

  const createDinner = (values: RecipeEditorValues) => {
    posthog.capture("create new dinner", { dinnerName: values.name });
    createMutation.mutate(dinnerFromEditorValues(values));
  };

  const cancelDraft = () => {
    setDraft(null);
    setMode("choose");
  };

  const backToChoose = () => {
    setImportError(null);
    setShowPasteFallback(false);
    setMode("choose");
  };

  const submitUrlImport = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = urlSchema.safeParse(url.trim());
    if (!parsed.success) {
      setImportError("FETCH_FAILED");
      return;
    }
    importFromUrlMutation.mutate({ url: parsed.data });
  };

  const submitTextImport = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    importFromTextMutation.mutate({ text: pasteText });
  };

  const isImporting =
    importFromUrlMutation.isPending || importFromTextMutation.isPending;

  if (mode === "manual") {
    return (
      <RecipeEditor
        isPending={createMutation.isPending}
        onCancel={() => void router.push("/dinners")}
        onSave={createDinner}
      />
    );
  }

  if (mode === "draft" && draft) {
    return (
      <RecipeEditor
        key={draftKey}
        initialValues={draft}
        showImportReview
        importReviewSourceUrl={draft.link}
        isPending={createMutation.isPending}
        onCancel={cancelDraft}
        onSave={createDinner}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-[640px] pb-6">
      <div className="bg-background/95 sticky top-0 z-20 -mx-4 mb-5 grid grid-cols-[1fr_auto_1fr] items-center border-b px-4 py-2 backdrop-blur">
        <Button
          type="button"
          variant="ghost"
          className="justify-self-start px-2"
          onClick={() => void router.push("/dinners")}
        >
          Cancel
        </Button>
        <h1 className="font-serif text-base font-normal">New dinner</h1>
        <div />
      </div>

      {mode === "choose" ? (
        <div className="space-y-3">
          <Button
            type="button"
            className="h-12 w-full justify-start"
            onClick={() => setMode("import")}
          >
            <LinkIcon />
            Import from link
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="h-12 w-full justify-start"
            onClick={() => setMode("manual")}
          >
            <Pencil />
            Create manually
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          <form className="space-y-3" onSubmit={submitUrlImport}>
            <div className="space-y-1.5">
              <FieldLabel htmlFor="recipe-import-url">Recipe link</FieldLabel>
              <Input
                id="recipe-import-url"
                type="url"
                value={url}
                disabled={isImporting}
                onChange={(event) => setUrl(event.target.value)}
                className="h-12 bg-white"
                placeholder="https://"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={isImporting}>
                {importFromUrlMutation.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Wand2 />
                )}
                Import
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={isImporting}
                onClick={backToChoose}
              >
                Back
              </Button>
            </div>
          </form>

          {isImporting && (
            <div className="text-muted-foreground rounded-md border bg-white px-3 py-2 text-sm">
              {loadingCopy[loadingStep]}
            </div>
          )}

          {importError && (
            <div className="space-y-4 rounded-md border bg-white p-3">
              <p className="text-destructive text-sm font-medium">
                {importErrorMessage(importError)}
              </p>
              {showPasteFallback && (
                <form className="space-y-3" onSubmit={submitTextImport}>
                  <div className="space-y-1.5">
                    <FieldLabel htmlFor="recipe-import-text">
                      Paste recipe text
                    </FieldLabel>
                    <Textarea
                      id="recipe-import-text"
                      value={pasteText}
                      disabled={isImporting}
                      onChange={(event) => setPasteText(event.target.value)}
                      className="min-h-40 bg-white text-[15px]"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={isImporting || pasteText.trim().length === 0}
                  >
                    {importFromTextMutation.isPending && (
                      <Loader2 className="animate-spin" />
                    )}
                    Import pasted recipe
                  </Button>
                </form>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const importErrorCode = (message: string): ImportErrorCode => {
  if (
    message === "FETCH_FAILED" ||
    message === "NO_RECIPE_FOUND" ||
    message === "EXTRACTION_FAILED"
  ) {
    return message;
  }

  return "EXTRACTION_FAILED";
};

const importErrorMessage = (code: ImportErrorCode) => {
  if (code === "FETCH_FAILED") {
    return "Could not fetch that page.";
  }
  if (code === "NO_RECIPE_FOUND") {
    return "No recipe was found on that page.";
  }
  return "Could not extract a recipe from that source.";
};

const FieldLabel = ({
  children,
  htmlFor,
}: {
  children: ReactNode;
  htmlFor: string;
}) => (
  <label
    htmlFor={htmlFor}
    className="text-muted-foreground block text-[11px] font-bold uppercase tracking-[0.1em]"
  >
    {children}
  </label>
);
