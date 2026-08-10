import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/router";
import {
  Check,
  ChevronRight,
  Circle,
  Loader2,
  Plus,
  UtensilsCrossed,
} from "lucide-react";
import {
  dinnerNameSchema,
  isYouTubeVideoUrl,
  sourceLabel,
  validUrlOrNull,
} from "@planeatrepeat/shared";

import { api } from "~/utils/api";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import {
  buildCreateDinnerEditorHref,
  editorSaveNavigation,
  planSlotDateFromString,
  type EditorImportSource,
} from "~/lib/editor-navigation";
import {
  importErrorCodeFromUnknown,
  importNameConflict,
  urlImportErrorCopy,
  urlImportPhases,
} from "~/lib/url-import";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "~/components/ResponsiveModal";
import {
  editorValuesFromRecipeInput,
  type RecipeEditorValues,
} from "~/views/Dinners/RecipeEditor";
import {
  type DinnerCreationNavigation,
  useDinnerCreation,
} from "~/views/Dinners/DinnerCreationContext";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  navigation: DinnerCreationNavigation;
};

type Screen = "choose" | "url" | "loading" | "error";
type ImportFailure = {
  code: ReturnType<typeof importErrorCodeFromUnknown>;
};

const importSources = ["Link", "YouTube video", "Photos", "Text"] as const;

function RecipeActionRow({
  children,
  dashed = false,
  onClick,
}: {
  children: ReactNode;
  dashed?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className={cn(
        "h-12 w-full justify-between rounded-lg bg-white px-4 text-left text-sm font-semibold",
        dashed && "border-dashed",
      )}
      onClick={onClick}
    >
      {children}
      <ChevronRight className="text-muted-foreground size-4" />
    </Button>
  );
}

export function AddDinnerSheet({ open, onOpenChange, navigation }: Props) {
  const router = useRouter();
  const utils = api.useUtils();
  const { setImportedDraft } = useDinnerCreation();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const importAttemptRef = useRef(0);
  const clipboardSourceRef = useRef<EditorImportSource | null>(null);
  const [screen, setScreen] = useState<Screen>("choose");
  const [source, setSource] = useState<EditorImportSource>("link");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [submittedUrl, setSubmittedUrl] = useState("");
  const [loadingSource, setLoadingSource] = useState("");
  const [loadingStep, setLoadingStep] = useState(0);
  const [importError, setImportError] = useState<ImportFailure | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(
    () => () => {
      importAttemptRef.current += 1;
      abortControllerRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    if (!open) {
      importAttemptRef.current += 1;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      setScreen("choose");
      setName("");
      setUrl("");
      setSubmittedUrl("");
      setImportError(null);
      setValidationError(null);
      clipboardSourceRef.current = null;
      return;
    }

    if (screen !== "choose") return;
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 100);
    return () => window.clearTimeout(focusTimer);
  }, [open, screen]);

  useEffect(() => {
    if (!open || screen !== "url") return;
    if (clipboardSourceRef.current === source) return;
    clipboardSourceRef.current = source;
    if (!navigator.clipboard?.readText) return;

    void navigator.clipboard
      .readText()
      .then((clipboardText) => {
        const clipboardUrl = validUrlOrNull(clipboardText);
        if (clipboardUrl) setUrl((current) => current || clipboardUrl);
      })
      .catch(() => undefined);
  }, [open, screen, source]);

  const navigateAfterSave = async (dinnerId: number) => {
    const saveNavigation = editorSaveNavigation(dinnerId, navigation);
    if (saveNavigation.base) {
      await router.replace(saveNavigation.base);
      await router.push(saveNavigation.destination);
    } else {
      await router.replace(saveNavigation.destination);
    }
  };

  const createMutation = api.dinner.create.useMutation({
    onSuccess: async ({ dinner }) => {
      await Promise.all([
        utils.dinner.summaries.invalidate(),
        utils.dinner.tags.invalidate(),
        utils.plan.plannedDinners.invalidate(),
      ]);

      onOpenChange(false);
      await navigateAfterSave(dinner.id);
    },
    onError: (error) => {
      setValidationError(error.message);
    },
  });

  const submitNameOnly = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = dinnerNameSchema.safeParse(name);
    if (!result.success) {
      setValidationError(
        result.error.issues[0]?.message ?? "Add a dinner name",
      );
      return;
    }

    setValidationError(null);
    createMutation.mutate({
      dinnerName: result.data,
      tagList: [],
      ...(navigation.date
        ? { planDate: planSlotDateFromString(navigation.date) }
        : {}),
    });
  };

  const continueInEditor = (draft?: {
    values: RecipeEditorValues;
    importedNameAlternative: string | null;
  }) => {
    if (draft) setImportedDraft(draft);
    onOpenChange(false);
    void router.push(
      buildCreateDinnerEditorHref({
        ...navigation,
        ...(draft ? {} : { mode: "manual" as const }),
        ...(name.trim() ? { name } : {}),
      }),
    );
  };

  const continueInExistingCreateFlow = () => {
    onOpenChange(false);
    void router.push(
      buildCreateDinnerEditorHref({
        ...navigation,
        ...(name.trim() ? { name } : {}),
      }),
    );
  };

  const beginUrlImport = async () => {
    const sourceUrl = validUrlOrNull(url);
    if (!sourceUrl || screen === "loading") return;

    const attempt = importAttemptRef.current + 1;
    importAttemptRef.current = attempt;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const phases = urlImportPhases(sourceUrl);
    setSubmittedUrl(sourceUrl);
    setLoadingSource(
      isYouTubeVideoUrl(sourceUrl) ? "YouTube video" : sourceLabel(sourceUrl),
    );
    setImportError(null);
    setLoadingStep(0);
    setScreen("loading");
    const interval = window.setInterval(() => {
      setLoadingStep((current) => Math.min(current + 1, phases.length - 1));
    }, 3_000);

    if (isYouTubeVideoUrl(sourceUrl)) {
      void utils.client.dinner.youtubeVideoTitle
        .query({ url: sourceUrl }, { signal: controller.signal })
        .then(({ title }) => {
          if (title && importAttemptRef.current === attempt) {
            setLoadingSource(title);
          }
        })
        .catch(() => undefined);
    }

    try {
      const result = await utils.client.dinner.importFromUrl.mutate(
        { url: sourceUrl },
        { signal: controller.signal },
      );
      if (controller.signal.aborted || importAttemptRef.current !== attempt) {
        return;
      }

      const typedName = name.trim() || undefined;
      setLoadingStep(phases.length);
      continueInEditor({
        values: editorValuesFromRecipeInput({
          name: typedName ?? result.name,
          recipe: result.recipe,
          link: result.sourceUrl,
        }),
        importedNameAlternative: importNameConflict(typedName, result.name),
      });
    } catch (error) {
      if (controller.signal.aborted || importAttemptRef.current !== attempt) {
        return;
      }
      setImportError({ code: importErrorCodeFromUnknown(error) });
      setScreen("error");
    } finally {
      window.clearInterval(interval);
      if (importAttemptRef.current === attempt) {
        abortControllerRef.current = null;
      }
    }
  };

  const cancelUrlImport = () => {
    importAttemptRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setScreen("url");
  };

  const requestOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && screen === "loading") return;
    onOpenChange(nextOpen);
  };

  const sourceTitle = source === "youtube" ? "YouTube video" : "Link";
  const validUrl = validUrlOrNull(url);
  const errorCopy = importError
    ? urlImportErrorCopy(importError.code, submittedUrl)
    : null;

  return (
    <ResponsiveModal open={open} onOpenChange={requestOpenChange}>
      <ResponsiveModalContent
        className={cn(
          "gap-0 bg-white",
          screen === "choose" || screen === "url"
            ? "h-auto max-h-[calc(100dvh-1rem)] overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 md:max-w-lg md:p-6"
            : "bg-background inset-0 h-dvh max-h-none w-full max-w-none rounded-none border-0 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-12 md:max-w-none",
        )}
      >
        {screen === "choose" ? (
          <>
            <ResponsiveModalHeader className="mb-5 text-center">
              <ResponsiveModalTitle className="font-serif text-xl font-normal">
                Add a dinner
              </ResponsiveModalTitle>
              <ResponsiveModalDescription className="sr-only">
                Quick-add a Name-only Dinner or continue to Recipe creation.
              </ResponsiveModalDescription>
            </ResponsiveModalHeader>

            <form onSubmit={submitNameOnly} className="space-y-2">
              <div className="grid grid-cols-[minmax(0,1fr)_3.25rem] gap-2">
                <Input
                  ref={inputRef}
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    setValidationError(null);
                  }}
                  autoFocus
                  disabled={createMutation.isPending}
                  placeholder="What's for dinner?"
                  aria-label="Dinner name"
                  aria-invalid={validationError !== null}
                  className="h-[52px] min-w-0 rounded-lg bg-white px-4 text-base font-semibold"
                />
                <Button
                  type="submit"
                  size="icon"
                  aria-label="Add Name-only Dinner"
                  disabled={
                    name.trim().length === 0 || createMutation.isPending
                  }
                  className="h-[52px] w-[52px] rounded-lg"
                >
                  {createMutation.isPending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Plus className="size-6" />
                  )}
                </Button>
              </div>
              {validationError && (
                <p role="alert" className="text-destructive text-sm">
                  {validationError}
                </p>
              )}
            </form>

            <div className="mt-6">
              <p className="text-muted-foreground mb-2 text-xs font-bold uppercase tracking-[0.12em]">
                Import a recipe
              </p>
              <div className="space-y-2">
                {importSources.map((importSource) => (
                  <RecipeActionRow
                    key={importSource}
                    onClick={() => {
                      if (
                        importSource === "Link" ||
                        importSource === "YouTube video"
                      ) {
                        setSource(importSource === "Link" ? "link" : "youtube");
                        setScreen("url");
                      } else {
                        continueInExistingCreateFlow();
                      }
                    }}
                  >
                    {importSource}
                  </RecipeActionRow>
                ))}
              </div>
            </div>

            <div className="border-border mt-5 border-t pt-4">
              <RecipeActionRow onClick={() => continueInEditor()} dashed>
                Write it myself
              </RecipeActionRow>
            </div>
          </>
        ) : screen === "url" ? (
          <>
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground -ml-2 w-fit px-2"
              onClick={() => setScreen("choose")}
            >
              ‹ Add a dinner
            </Button>
            <h2 className="mb-7 mt-6 font-serif text-4xl">{sourceTitle}</h2>
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void beginUrlImport();
              }}
            >
              <label htmlFor="recipe-import-url" className="sr-only">
                Recipe URL
              </label>
              <Input
                id="recipe-import-url"
                type="url"
                inputMode="url"
                value={url}
                autoFocus
                onChange={(event) => setUrl(event.target.value)}
                className="h-16 rounded-lg bg-white px-4 text-base"
                placeholder="https://"
                aria-invalid={url.length > 0 && !validUrl}
                aria-describedby="recipe-url-help"
              />
              <p id="recipe-url-help" className="text-muted-foreground text-xs">
                {url.length > 0 && !validUrl
                  ? "Enter a full http or https URL."
                  : "Recipe pages and YouTube links both work here."}
              </p>
              <Button
                type="submit"
                className="h-12 w-full text-base"
                disabled={!validUrl}
              >
                Import recipe
              </Button>
            </form>
          </>
        ) : screen === "loading" ? (
          <>
            <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center">
              <div className="border-primary text-primary flex size-20 items-center justify-center rounded-full border bg-[hsl(18_70%_91%)]">
                <UtensilsCrossed className="size-9 animate-spin [animation-duration:3s]" />
              </div>
              <ResponsiveModalTitle className="mt-8 text-center font-serif text-4xl leading-tight">
                Reading the recipe
              </ResponsiveModalTitle>
              <ResponsiveModalDescription className="text-muted-foreground mt-5 text-center text-lg font-semibold">
                {loadingSource}
              </ResponsiveModalDescription>

              <ol className="mt-10 w-full max-w-[270px] space-y-5">
                {urlImportPhases(submittedUrl).map((phase, index) => {
                  const done = index < loadingStep;
                  const current = index === loadingStep;
                  return (
                    <li
                      key={phase}
                      className={
                        current
                          ? "text-primary flex items-center gap-4 font-semibold"
                          : done
                            ? "text-foreground flex items-center gap-4 font-semibold"
                            : "text-muted-foreground/60 flex items-center gap-4 font-semibold"
                      }
                    >
                      {done ? (
                        <span className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-full">
                          <Check className="size-5" />
                        </span>
                      ) : (
                        <Circle
                          className={
                            current
                              ? "fill-primary/10 size-8 shrink-0"
                              : "size-8 shrink-0"
                          }
                        />
                      )}
                      {phase}
                    </li>
                  );
                })}
              </ol>
            </div>
            <Button
              type="button"
              variant="outline"
              className="mx-auto h-12 w-full max-w-sm bg-white text-base"
              onClick={cancelUrlImport}
            >
              Cancel
            </Button>
          </>
        ) : errorCopy ? (
          <>
            <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center text-center">
              <div className="border-border flex size-20 items-center justify-center rounded-full border bg-white font-serif text-4xl">
                !
              </div>
              <ResponsiveModalTitle className="mt-8 font-serif text-4xl leading-tight">
                {errorCopy.title}
              </ResponsiveModalTitle>
              <ResponsiveModalDescription className="text-muted-foreground mt-3 text-lg leading-relaxed">
                {errorCopy.body}
              </ResponsiveModalDescription>
            </div>
            <div className="mx-auto w-full max-w-sm space-y-3">
              <Button
                type="button"
                className="h-12 w-full text-base"
                onClick={() => void beginUrlImport()}
              >
                Try again
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full bg-white text-base"
                onClick={() => continueInEditor()}
              >
                Write it myself
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-12 w-full text-base"
                onClick={() => setScreen("url")}
              >
                Back
              </Button>
            </div>
          </>
        ) : null}
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
