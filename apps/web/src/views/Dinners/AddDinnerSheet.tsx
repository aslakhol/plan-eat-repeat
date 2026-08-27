import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/router";
import {
  Camera,
  Check,
  ChevronRight,
  Circle,
  Image as ImageIcon,
  Loader2,
  Plus,
  UtensilsCrossed,
  X,
} from "lucide-react";
import {
  dinnerNameSchema,
  isInstagramMediaUrl,
  isYouTubeVideoUrl,
  MAX_RECIPE_IMPORT_IMAGES,
  sourceLabel,
  validUrlOrNull,
} from "@planeatrepeat/shared";

import { api } from "~/utils/api";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";
import {
  buildCreateDinnerEditorHref,
  editorSaveNavigation,
  planSlotDateFromString,
} from "~/lib/editor-navigation";
import {
  importErrorCopy,
  importErrorCodeFromUnknown,
  importNameConflict,
  importPhases,
  type RecipeImportSource,
} from "~/lib/url-import";
import { appendPreparedPhotos, type PreparedPhoto } from "~/lib/photo-import";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "~/components/ResponsiveModal";
import { type RecipeEditorValues } from "~/views/Dinners/RecipeEditor";
import { type ExistingDinnerRecipeImport } from "~/lib/existing-dinner-import";
import { editorValuesFromRecipeInput } from "~/lib/recipe-editor-values";
import {
  type DinnerCreationNavigation,
  useDinnerCreation,
} from "~/views/Dinners/DinnerCreationContext";

type SharedProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type CreateDinnerSheetProps = SharedProps & {
  mode?: "create";
  navigation: DinnerCreationNavigation;
};

type ExistingDinnerImportSheetProps = SharedProps & {
  mode: "existing";
  onImported: (imported: ExistingDinnerRecipeImport) => void;
};

type Props = CreateDinnerSheetProps | ExistingDinnerImportSheetProps;

type Screen = "choose" | "url" | "photos" | "text" | "loading" | "error";
type SourceScreen = Extract<Screen, "url" | "photos" | "text">;
type ImportFailure = {
  code: ReturnType<typeof importErrorCodeFromUnknown>;
};

type ImportInput = {
  photoCount: number;
  text: string;
  url: string | null;
};

const urlInputReady = ({ url }: ImportInput) => url !== null;
const urlLoadingLabel = ({ url }: ImportInput) =>
  url && isYouTubeVideoUrl(url)
    ? "YouTube video"
    : url && isInstagramMediaUrl(url)
      ? "Instagram video"
      : url
        ? sourceLabel(url)
        : "";

const sourceDefinitions: Record<
  RecipeImportSource,
  {
    label: string;
    screen: SourceScreen;
    createsSourceLink: boolean;
    inputReady: (input: ImportInput) => boolean;
    loadingLabel: (input: ImportInput) => string;
  }
> = {
  link: {
    label: "Link",
    screen: "url",
    createsSourceLink: true,
    inputReady: urlInputReady,
    loadingLabel: urlLoadingLabel,
  },
  youtube: {
    label: "YouTube video",
    screen: "url",
    createsSourceLink: true,
    inputReady: urlInputReady,
    loadingLabel: urlLoadingLabel,
  },
  instagram: {
    label: "Instagram",
    screen: "url",
    createsSourceLink: true,
    inputReady: urlInputReady,
    loadingLabel: urlLoadingLabel,
  },
  photos: {
    label: "Photos",
    screen: "photos",
    createsSourceLink: false,
    inputReady: ({ photoCount }) => photoCount > 0,
    loadingLabel: ({ photoCount }) =>
      `${photoCount} ${photoCount === 1 ? "photo" : "photos"}`,
  },
  text: {
    label: "Text",
    screen: "text",
    createsSourceLink: false,
    inputReady: ({ text }) => text.trim().length > 0,
    loadingLabel: () => "Pasted or typed text",
  },
};

const importSourceOrder: RecipeImportSource[] = [
  "link",
  "youtube",
  "instagram",
  "photos",
  "text",
];

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

export function AddDinnerSheet(props: Props) {
  const { open, onOpenChange } = props;
  const flow =
    props.mode === "existing"
      ? {
          chooserTitle: "Import a recipe",
          chooserDescription:
            "Choose a source to replace this Dinner's Recipe draft.",
          sourceBackLabel: "Import a recipe",
          showNameEntry: false,
          navigation: { origin: "cookbook" } as DinnerCreationNavigation,
          onImported: props.onImported,
        }
      : {
          chooserTitle: "Add a dinner",
          chooserDescription:
            "Quick-add a Name-only Dinner or continue to Recipe creation.",
          sourceBackLabel: "Add a dinner",
          showNameEntry: true,
          navigation: props.navigation,
          onImported: null,
        };
  const { navigation } = flow;
  const router = useRouter();
  const utils = api.useUtils();
  const { setImportedDraft } = useDinnerCreation();
  const inputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const importAttemptRef = useRef(0);
  const clipboardSourceRef = useRef<RecipeImportSource | null>(null);
  const [screen, setScreen] = useState<Screen>("choose");
  const [source, setSource] = useState<RecipeImportSource>("link");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<PreparedPhoto[]>([]);
  const [preparingPhotos, setPreparingPhotos] = useState(false);
  const [photoInputError, setPhotoInputError] = useState<string | null>(null);
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
      setText("");
      setPhotos([]);
      setPreparingPhotos(false);
      setPhotoInputError(null);
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
    if (flow.onImported) {
      onOpenChange(false);
      return;
    }
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

  const beginImport = async () => {
    const sourceUrl = validUrlOrNull(url);
    const importInput = { photoCount: photos.length, text, url: sourceUrl };
    const definition = sourceDefinitions[source];
    if (screen === "loading" || !definition.inputReady(importInput)) {
      return;
    }

    const attempt = importAttemptRef.current + 1;
    importAttemptRef.current = attempt;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const phases = importPhases(source, sourceUrl ?? "");
    setSubmittedUrl(sourceUrl ?? "");
    setLoadingSource(definition.loadingLabel(importInput));
    setImportError(null);
    setLoadingStep(0);
    setScreen("loading");
    const interval = window.setInterval(() => {
      setLoadingStep((current) => Math.min(current + 1, phases.length - 1));
    }, 3_000);

    if (sourceUrl && isYouTubeVideoUrl(sourceUrl)) {
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
      const importUrl = () =>
        utils.client.dinner.importFromUrl.mutate(
          { url: sourceUrl! },
          { signal: controller.signal },
        );
      const importers: Record<
        RecipeImportSource,
        () => Promise<{
          name: string;
          recipe: Parameters<typeof editorValuesFromRecipeInput>[0]["recipe"];
        }>
      > = {
        link: importUrl,
        youtube: importUrl,
        instagram: importUrl,
        photos: () =>
          utils.client.dinner.importFromImages.mutate(
            {
              images: photos.map(({ data, mimeType }) => ({ data, mimeType })),
            },
            { signal: controller.signal },
          ),
        text: () =>
          utils.client.dinner.importFromText.mutate(
            { text: text.trim() },
            { signal: controller.signal },
          ),
      };
      const result = await importers[source]();
      if (controller.signal.aborted || importAttemptRef.current !== attempt) {
        return;
      }

      const typedName = name.trim() || undefined;
      setLoadingStep(phases.length);
      if (flow.onImported) {
        flow.onImported({
          name: result.name,
          recipe: result.recipe,
          sourceLink:
            definition.createsSourceLink && sourceUrl ? sourceUrl : null,
        });
        onOpenChange(false);
        return;
      }
      continueInEditor({
        values: editorValuesFromRecipeInput({
          name: typedName ?? result.name,
          recipe: result.recipe,
          ...(definition.createsSourceLink && sourceUrl
            ? { sourceLink: sourceUrl }
            : {}),
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

  const sourceScreen = () => sourceDefinitions[source].screen;

  const cancelImport = () => {
    importAttemptRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setScreen(sourceScreen());
  };

  const onPhotoFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setPreparingPhotos(true);
    setPhotoInputError(null);
    try {
      const result = await appendPreparedPhotos(photos, Array.from(files));
      setPhotos(result.photos);
      setPhotoInputError(result.notice);
    } catch (error) {
      setPhotoInputError(
        error instanceof Error
          ? error.message
          : "Could not prepare that photo.",
      );
    } finally {
      setPreparingPhotos(false);
    }
  };

  const requestOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && (screen === "loading" || screen === "error")) return;
    onOpenChange(nextOpen);
  };

  const sourceTitle = sourceDefinitions[source].label;
  const validUrl = validUrlOrNull(url);
  const errorCopy = importError
    ? importErrorCopy(importError.code, source, submittedUrl)
    : null;

  return (
    <ResponsiveModal open={open} onOpenChange={requestOpenChange}>
      <ResponsiveModalContent
        scrollViewport
        scrollViewportClassName="flex min-h-0 flex-1 flex-col"
        className={cn(
          "gap-0 bg-white",
          screen === "choose" ||
            screen === "url" ||
            screen === "photos" ||
            screen === "text"
            ? "h-auto max-h-[calc(100dvh-1rem)] overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 md:max-w-lg md:p-6"
            : "bg-background inset-0 mt-0 h-dvh max-h-none w-full max-w-none rounded-none border-0 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-12 md:inset-auto md:left-1/2 md:top-1/2 md:h-[min(90dvh,680px)] md:max-h-[90dvh] md:max-w-lg md:rounded-lg md:border md:p-8",
        )}
      >
        {screen === "choose" ? (
          <>
            <ResponsiveModalHeader className="mb-5 text-center">
              <ResponsiveModalTitle className="font-serif text-xl font-normal">
                {flow.chooserTitle}
              </ResponsiveModalTitle>
              <ResponsiveModalDescription className="sr-only">
                {flow.chooserDescription}
              </ResponsiveModalDescription>
            </ResponsiveModalHeader>

            {flow.showNameEntry && (
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
            )}

            <div className={flow.showNameEntry ? "mt-6" : undefined}>
              {flow.showNameEntry && (
                <p className="text-muted-foreground mb-2 text-xs font-bold uppercase tracking-[0.12em]">
                  Import a recipe
                </p>
              )}
              <div className="space-y-2">
                {importSourceOrder.map((importSource) => (
                  <RecipeActionRow
                    key={importSource}
                    onClick={() => {
                      setSource(importSource);
                      setScreen(sourceDefinitions[importSource].screen);
                    }}
                  >
                    {sourceDefinitions[importSource].label}
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
              ‹ {flow.sourceBackLabel}
            </Button>
            <h2 className="mb-7 mt-6 font-serif text-4xl">{sourceTitle}</h2>
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void beginImport();
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
                aria-describedby={
                  url.length > 0 && !validUrl
                    ? "recipe-url-validation"
                    : undefined
                }
              />
              {url.length > 0 && !validUrl && (
                <p
                  id="recipe-url-validation"
                  role="alert"
                  className="text-destructive text-xs"
                >
                  Enter a full http or https URL.
                </p>
              )}
              <Button
                type="submit"
                className="h-12 w-full text-base"
                disabled={!validUrl}
              >
                Import recipe
              </Button>
            </form>
          </>
        ) : screen === "photos" ? (
          <>
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground -ml-2 w-fit px-2"
              onClick={() => setScreen("choose")}
            >
              ‹ {flow.sourceBackLabel}
            </Button>
            <h2 className="mb-5 mt-6 font-serif text-4xl">Photos</h2>
            <p
              id="photo-import-limit"
              className="text-muted-foreground mb-4 text-sm"
            >
              Choose up to {MAX_RECIPE_IMPORT_IMAGES} photos. They’ll be read in
              the order shown.
            </p>

            <input
              ref={libraryInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              aria-label="Choose recipe photos"
              onChange={(event) => {
                void onPhotoFilesSelected(event.currentTarget.files);
                event.currentTarget.value = "";
              }}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              aria-label="Take a recipe photo"
              onChange={(event) => {
                void onPhotoFilesSelected(event.currentTarget.files);
                event.currentTarget.value = "";
              }}
            />

            {photos.length === 0 ? (
              <button
                type="button"
                disabled={preparingPhotos}
                aria-describedby="photo-import-limit"
                className="border-border text-muted-foreground hover:bg-accent flex h-44 w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-white font-semibold disabled:opacity-60"
                onClick={() => libraryInputRef.current?.click()}
              >
                <Plus className="size-8" />
                No photos yet
              </button>
            ) : (
              <div
                className="grid grid-cols-3 gap-3"
                aria-label="Selected photos"
              >
                {photos.map((photo, index) => (
                  <div
                    key={`${photo.previewUrl.slice(-24)}-${index}`}
                    className="relative aspect-[3/4] min-w-0"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.previewUrl}
                      alt={`Recipe photo ${index + 1} of ${photos.length}`}
                      className="border-border size-full rounded-lg border object-cover"
                    />
                    <button
                      type="button"
                      aria-label={`Remove recipe photo ${index + 1}`}
                      disabled={preparingPhotos}
                      className="bg-foreground/70 text-background absolute right-2 top-2 flex size-8 items-center justify-center rounded-full disabled:opacity-60"
                      onClick={() => {
                        setPhotos((current) =>
                          current.filter(
                            (_, photoIndex) => photoIndex !== index,
                          ),
                        );
                        setPhotoInputError(null);
                      }}
                    >
                      <X className="size-5" />
                    </button>
                  </div>
                ))}
                {photos.length < MAX_RECIPE_IMPORT_IMAGES && (
                  <button
                    type="button"
                    aria-label="Add more recipe photos"
                    aria-describedby="photo-import-limit"
                    disabled={preparingPhotos}
                    className="border-border text-muted-foreground hover:bg-accent flex aspect-[3/4] items-center justify-center rounded-lg border border-dashed bg-white disabled:opacity-60"
                    onClick={() => libraryInputRef.current?.click()}
                  >
                    <Plus className="size-8" />
                  </button>
                )}
              </div>
            )}

            {preparingPhotos && (
              <p className="text-muted-foreground mt-3 flex items-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin" />
                Preparing photos…
              </p>
            )}
            {photos.length === MAX_RECIPE_IMPORT_IMAGES && !photoInputError && (
              <p role="status" className="text-muted-foreground mt-3 text-sm">
                Maximum {MAX_RECIPE_IMPORT_IMAGES} photos selected.
              </p>
            )}
            {photoInputError && (
              <p role="alert" className="text-destructive mt-3 text-sm">
                {photoInputError}
              </p>
            )}

            {photos.length === 0 && (
              <div className="mt-4 space-y-3">
                <Button
                  type="button"
                  className="h-12 w-full text-base"
                  disabled={preparingPhotos}
                  onClick={() => libraryInputRef.current?.click()}
                >
                  <ImageIcon className="size-5" />
                  Choose photos
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 w-full bg-white text-base"
                  disabled={preparingPhotos}
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <Camera className="size-5" />
                  Take a photo
                </Button>
              </div>
            )}
            {photos.length > 0 && (
              <Button
                type="button"
                className="mt-5 h-12 w-full text-base"
                disabled={preparingPhotos}
                onClick={() => void beginImport()}
              >
                Import recipe
              </Button>
            )}
          </>
        ) : screen === "text" ? (
          <>
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground -ml-2 w-fit px-2"
              onClick={() => setScreen("choose")}
            >
              ‹ {flow.sourceBackLabel}
            </Button>
            <h2 className="mb-7 mt-6 font-serif text-4xl">Text</h2>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void beginImport();
              }}
            >
              <label htmlFor="recipe-import-text" className="sr-only">
                Recipe text
              </label>
              <Textarea
                id="recipe-import-text"
                value={text}
                autoFocus
                rows={8}
                onChange={(event) => setText(event.target.value)}
                className="min-h-64 resize-none rounded-lg bg-white px-4 py-4 text-base"
                placeholder="Paste or type the recipe"
              />
              <Button
                type="submit"
                className="h-12 w-full text-base"
                disabled={text.trim().length === 0}
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
                {importPhases(source, submittedUrl).map((phase, index) => {
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
              onClick={cancelImport}
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
                onClick={() => void beginImport()}
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
                onClick={() => setScreen(sourceScreen())}
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
