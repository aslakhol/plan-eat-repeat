import { type FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { usePostHog } from "posthog-js/react";
import {
  Check,
  Circle,
  Camera,
  Image as ImagesIcon,
  Loader2,
  LinkIcon,
  Pencil,
  Plus,
  UtensilsCrossed,
  Wand2,
  X,
} from "lucide-react";
import {
  MAX_RECIPE_IMPORT_IMAGE_DATA_LENGTH,
  MAX_RECIPE_IMPORT_IMAGES,
  YOUTUBE_NO_RECIPE_FOUND_MESSAGE,
  type ImportRecipeErrorCode,
  isYouTubeVideoUrl,
  importErrorMessages,
  validUrlOrNull,
  sourceLabel,
} from "@planeatrepeat/shared";
import { toast } from "../../components/ui/use-toast";
import { api } from "../../utils/api";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import {
  FieldLabel,
  RecipeEditor,
  dinnerFromEditorValues,
  editorValuesFromManualName,
  editorValuesFromRecipeInput,
  type RecipeEditorValues,
} from "./RecipeEditor";
import {
  editorCancelHref,
  editorSaveNavigation,
  parseEditorNavigation,
  planSlotDateFromString,
} from "~/lib/editor-navigation";
import {
  importNameConflict,
  urlImportErrorCopy,
  urlImportPhases,
} from "~/lib/url-import";

type CreateMode =
  | "choose"
  | "manual"
  | "import"
  | "url"
  | "url-loading"
  | "url-error"
  | "photos"
  | "draft";
type PreparedImage = {
  previewUrl: string;
  data: string;
  mimeType: "image/jpeg";
};
type ImportFailure = {
  code: ImportRecipeErrorCode;
  isYouTube: boolean;
};

const loadingCopy = [
  "Fetching the page",
  "Looking for structured recipe data",
  "Normalizing ingredients and steps",
];
const youtubeLoadingCopy = [
  "Fetching video details",
  "Reading the video's description and captions…",
  "Normalizing ingredients and steps",
];
const photoLoadingCopy = ["Reading your photos…", "Writing up the recipe…"];
const PHOTO_LONGEST_EDGE = 1_800;
const PHOTO_COMPRESSION = 0.7;
const photoImportErrorCopy =
  "We couldn't read that page — try retaking it with less glare.";

const importErrorCodeFromUnknown = (error: unknown): ImportRecipeErrorCode => {
  if (typeof error !== "object" || error === null || !("data" in error)) {
    return "EXTRACTION_FAILED";
  }
  const data = error.data;
  if (
    typeof data !== "object" ||
    data === null ||
    !("importErrorCode" in data)
  ) {
    return "EXTRACTION_FAILED";
  }
  const code = data.importErrorCode;
  return typeof code === "string" &&
    [
      "FETCH_FAILED",
      "SITE_BLOCKED",
      "PAGE_UNREADABLE",
      "NO_RECIPE_FOUND",
      "EXTRACTION_FAILED",
    ].includes(code)
    ? (code as ImportRecipeErrorCode)
    : "EXTRACTION_FAILED";
};

const base64FromBlob = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.slice(dataUrl.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Could not read that photo."));
    reader.readAsDataURL(blob);
  });

// Always re-encode to JPEG so the server only sees mime types it validates,
// and downscale so a few pages stay under the request body limit.
const prepareImageFile = async (file: File): Promise<PreparedImage> => {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(
      `Your browser can't read ${file.name}. Convert it to JPEG or PNG and try again.`,
    );
  }

  try {
    const scale = Math.min(
      1,
      PHOTO_LONGEST_EDGE / Math.max(bitmap.width, bitmap.height),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not prepare that photo.");
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", PHOTO_COMPRESSION),
    );
    if (!blob) {
      throw new Error("Could not prepare that photo.");
    }
    const data = await base64FromBlob(blob);

    return {
      previewUrl: `data:image/jpeg;base64,${data}`,
      data,
      mimeType: "image/jpeg",
    };
  } finally {
    bitmap.close();
  }
};

export const CreateDinner = () => {
  const router = useRouter();
  const posthog = usePostHog();
  const utils = api.useUtils();
  const navigation = parseEditorNavigation(router.query);
  const [mode, setMode] = useState<CreateMode>(() =>
    navigation.mode === "manual"
      ? "manual"
      : navigation.source
        ? "url"
        : "choose",
  );
  const [url, setUrl] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [importError, setImportError] = useState<ImportFailure | null>(null);
  const [showPasteFallback, setShowPasteFallback] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [draft, setDraft] = useState<RecipeEditorValues | null>(null);
  const [importedNameAlternative, setImportedNameAlternative] = useState<
    string | null
  >(null);
  const [urlImportPending, setUrlImportPending] = useState(false);
  const [submittedUrl, setSubmittedUrl] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);
  const importAttemptRef = useRef(0);
  const clipboardSourceRef = useRef<string | null>(null);
  const [images, setImages] = useState<PreparedImage[]>([]);
  const [preparingImages, setPreparingImages] = useState(false);
  const [photoLoadingStep, setPhotoLoadingStep] = useState(0);
  const [photoImportError, setPhotoImportError] =
    useState<ImportRecipeErrorCode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (router.isReady && navigation.mode === "manual") {
      setMode("manual");
    } else if (router.isReady && navigation.source) {
      setMode("url");
    }
  }, [navigation.mode, navigation.source, router.isReady]);

  useEffect(
    () => () => {
      importAttemptRef.current += 1;
      abortControllerRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    if (mode !== "url" || !navigation.source) return;
    if (clipboardSourceRef.current === navigation.source) return;
    clipboardSourceRef.current = navigation.source;
    if (!navigator.clipboard?.readText) return;

    void navigator.clipboard
      .readText()
      .then((clipboardText) => {
        const clipboardUrl = validUrlOrNull(clipboardText);
        if (clipboardUrl) setUrl((current) => current || clipboardUrl);
      })
      .catch(() => undefined);
  }, [mode, navigation.source]);

  const createMutation = api.dinner.create.useMutation({
    onSuccess: async (result) => {
      if (!navigation.date) {
        toast({ title: `${result.dinner.name} created` });
      }
      await Promise.all([
        utils.dinner.summaries.invalidate(),
        utils.dinner.tags.invalidate(),
        utils.dinner.ingredientNames.invalidate(),
        utils.plan.plannedDinners.invalidate(),
      ]);
      const saveNavigation = editorSaveNavigation(result.dinner.id, navigation);
      if (saveNavigation.base) {
        await router.replace(saveNavigation.base);
        void router.push(saveNavigation.destination);
      } else {
        void router.replace(saveNavigation.destination);
      }
    },
    onError: (error) => {
      setSubmitError(error.message);
      toast({
        variant: "destructive",
        title: "Could not create dinner",
        description: error.message,
      });
    },
  });

  const beginUrlImport = async () => {
    const sourceUrl = validUrlOrNull(url);
    if (!sourceUrl || urlImportPending) return;

    const attempt = importAttemptRef.current + 1;
    importAttemptRef.current = attempt;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const phases = urlImportPhases(sourceUrl);
    setSubmittedUrl(sourceUrl);
    setImportError(null);
    setLoadingStep(0);
    setUrlImportPending(true);
    setMode("url-loading");
    const interval = window.setInterval(() => {
      setLoadingStep((current) => Math.min(current + 1, phases.length - 1));
    }, 3_000);

    try {
      const result = await utils.client.dinner.importFromUrl.mutate(
        { url: sourceUrl },
        { signal: controller.signal },
      );
      if (controller.signal.aborted || importAttemptRef.current !== attempt) {
        return;
      }

      const typedName = navigation.name?.trim();
      setImportedNameAlternative(importNameConflict(typedName, result.name));
      setDraft(
        editorValuesFromRecipeInput({
          name: typedName ?? result.name,
          recipe: result.recipe,
          link: result.sourceUrl,
        }),
      );
      setLoadingStep(phases.length);
      setMode("draft");
    } catch (error) {
      if (controller.signal.aborted || importAttemptRef.current !== attempt) {
        return;
      }
      setImportError({
        code: importErrorCodeFromUnknown(error),
        isYouTube: isYouTubeVideoUrl(sourceUrl),
      });
      setMode("url-error");
    } finally {
      window.clearInterval(interval);
      if (importAttemptRef.current === attempt) {
        abortControllerRef.current = null;
        setUrlImportPending(false);
      }
    }
  };

  const cancelUrlImport = () => {
    importAttemptRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setUrlImportPending(false);
    setMode("url");
  };

  const importFromTextMutation = api.dinner.importFromText.useMutation({
    onMutate: () => {
      setImportError(null);
      setLoadingStep(loadingCopy.length - 1);
    },
    onSuccess: (result) => {
      setDraft(
        editorValuesFromRecipeInput({
          name: result.name,
          recipe: result.recipe,
          link: validUrlOrNull(url),
        }),
      );
      setMode("draft");
    },
    onError: (error) => {
      setImportError({
        code: error.data?.importErrorCode ?? "EXTRACTION_FAILED",
        isYouTube: false,
      });
    },
  });

  const importFromImagesMutation = api.dinner.importFromImages.useMutation({
    onMutate: () => {
      setPhotoImportError(null);
      setPhotoLoadingStep(0);
      const interval = window.setInterval(() => {
        setPhotoLoadingStep((current) =>
          Math.min(current + 1, photoLoadingCopy.length - 1),
        );
      }, 3_000);

      return { interval };
    },
    onSuccess: (result) => {
      setDraft(
        editorValuesFromRecipeInput({
          name: result.name,
          recipe: result.recipe,
        }),
      );
      setMode("draft");
    },
    onError: (error) => {
      setPhotoImportError(error.data?.importErrorCode ?? "EXTRACTION_FAILED");
    },
    onSettled: (_data, _error, _variables, context) => {
      if (context?.interval) {
        window.clearInterval(context.interval);
      }
    },
  });

  const isPreparingOrImportingImages =
    preparingImages || importFromImagesMutation.isPending;

  const createDinner = (values: RecipeEditorValues) => {
    posthog.capture("create new dinner", { dinnerName: values.name });
    setSubmitError(null);
    createMutation.mutate({
      ...dinnerFromEditorValues(values),
      ...(navigation.date
        ? { planDate: planSlotDateFromString(navigation.date) }
        : {}),
    });
  };

  const backToChoose = () => {
    setImportError(null);
    setShowPasteFallback(false);
    setPhotoImportError(null);
    setMode("choose");
  };

  const addPhotoFiles = async (files: File[]) => {
    const availableSlots = MAX_RECIPE_IMPORT_IMAGES - images.length;
    if (availableSlots <= 0) return;

    setPreparingImages(true);
    try {
      const prepared = await Promise.all(
        files.slice(0, availableSlots).map(prepareImageFile),
      );
      if (prepared.length === 0) return;

      const nextImages = [...images, ...prepared];
      const totalDataLength = nextImages.reduce(
        (total, image) => total + image.data.length,
        0,
      );
      if (totalDataLength > MAX_RECIPE_IMPORT_IMAGE_DATA_LENGTH) {
        toast({
          variant: "destructive",
          title: "Photos are too large",
          description:
            "Remove a page or retake the photos a little farther away.",
        });
        return;
      }

      setImages(nextImages);
      setPhotoImportError(null);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Could not prepare photos",
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setPreparingImages(false);
    }
  };

  const onPhotoFilesSelected = async (files: FileList | null) => {
    if (files && files.length > 0) {
      await addPhotoFiles(Array.from(files));
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const submitImageImport = () => {
    importFromImagesMutation.mutate({
      images: images.map(({ data, mimeType }) => ({ data, mimeType })),
    });
  };

  const submitUrlImport = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const sourceUrl = validUrlOrNull(url);
    if (!sourceUrl) {
      return;
    }
    void beginUrlImport();
  };

  const submitTextImport = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    importFromTextMutation.mutate({ text: pasteText });
  };

  const isImporting = urlImportPending || importFromTextMutation.isPending;

  if (!router.isReady) {
    return (
      <div className="flex h-[50dvh] items-center justify-center">
        <Loader2
          className="text-primary animate-spin"
          aria-label="Loading editor"
        />
      </div>
    );
  }

  if (mode === "url-loading") {
    const phases = urlImportPhases(submittedUrl);
    return (
      <div className="bg-background fixed inset-0 z-[100] flex min-h-dvh flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-12">
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center">
          <div className="border-primary text-primary flex size-20 items-center justify-center rounded-full border bg-[hsl(18_70%_91%)]">
            <UtensilsCrossed className="size-9 animate-spin [animation-duration:3s]" />
          </div>
          <h1 className="mt-8 text-center font-serif text-4xl leading-tight">
            Reading the recipe
          </h1>
          <p className="text-muted-foreground mt-5 text-center text-lg font-semibold">
            {sourceLabel(submittedUrl)}
          </p>

          <ol className="mt-10 w-full max-w-[270px] space-y-5">
            {phases.map((phase, index) => {
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
      </div>
    );
  }

  if (mode === "url-error" && importError) {
    const copy = urlImportErrorCopy(importError.code, submittedUrl);
    return (
      <div className="bg-background fixed inset-0 z-[100] flex min-h-dvh flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-12">
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center text-center">
          <div className="border-border flex size-20 items-center justify-center rounded-full border bg-white font-serif text-4xl">
            !
          </div>
          <h1 className="mt-8 font-serif text-4xl leading-tight">
            {copy.title}
          </h1>
          <p className="text-muted-foreground mt-3 text-lg leading-relaxed">
            {copy.body}
          </p>
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
            onClick={() => setMode("manual")}
          >
            Write it myself
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-12 w-full text-base"
            onClick={() => setMode("url")}
          >
            Back
          </Button>
        </div>
      </div>
    );
  }

  if (mode === "url" && navigation.source) {
    const validUrl = validUrlOrNull(url);
    const sourceTitle =
      navigation.source === "youtube" ? "YouTube video" : "Link";
    return (
      <div className="mx-auto w-full max-w-[640px] pb-6">
        <Button
          type="button"
          variant="ghost"
          className="text-muted-foreground -ml-2 px-2"
          onClick={() => void router.back()}
        >
          ‹ Add a dinner
        </Button>
        <h1 className="mb-7 mt-6 font-serif text-4xl">{sourceTitle}</h1>
        <form className="space-y-3" onSubmit={submitUrlImport}>
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
      </div>
    );
  }

  if (mode === "manual") {
    return (
      <RecipeEditor
        key={navigation.name ?? "manual-dinner"}
        initialValues={editorValuesFromManualName(navigation.name ?? "")}
        isPending={createMutation.isPending}
        submitError={submitError}
        onCancel={() => void router.replace(editorCancelHref(navigation))}
        onSave={createDinner}
      />
    );
  }

  if (mode === "draft" && draft) {
    return (
      <RecipeEditor
        key={`${draft.name}-${draft.link}`}
        initialValues={draft}
        importedNameAlternative={importedNameAlternative}
        isPending={createMutation.isPending}
        submitError={submitError}
        onCancel={() => void router.replace(editorCancelHref(navigation))}
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
          onClick={() => void router.replace(editorCancelHref(navigation))}
        >
          Cancel
        </Button>
        <h1 className="font-serif text-base font-normal">
          {mode === "photos" ? "Import from photo" : "New dinner"}
        </h1>
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
            onClick={() => setMode("photos")}
          >
            <Camera />
            Import from photo
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full justify-start"
            onClick={() => setMode("manual")}
          >
            <Pencil />
            Create manually
          </Button>
        </div>
      ) : mode === "photos" ? (
        <div className="space-y-5">
          <div className="space-y-1.5">
            <h2 className="text-foreground font-serif text-2xl">
              Photograph the recipe
            </h2>
            <p className="text-muted-foreground text-sm">
              Fill the frame with the page, avoid glare. Up to{" "}
              {MAX_RECIPE_IMPORT_IMAGES} pages.
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => void onPhotoFilesSelected(event.target.files)}
          />

          {images.length === 0 ? (
            <button
              type="button"
              disabled={isPreparingOrImportingImages}
              className="border-border text-muted-foreground hover:bg-accent flex h-36 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-white text-sm disabled:opacity-60"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagesIcon className="size-5" />
              Choose photos
            </button>
          ) : (
            <div className="flex flex-wrap gap-3">
              {images.map((image, index) => (
                <div key={image.previewUrl} className="relative h-36 w-28">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.previewUrl}
                    alt={`Recipe page ${index + 1}`}
                    className="border-border h-36 w-28 rounded-lg border object-cover"
                  />
                  <button
                    type="button"
                    aria-label={`Remove photo ${index + 1}`}
                    disabled={isPreparingOrImportingImages}
                    className="bg-destructive text-destructive-foreground absolute -right-2 -top-2 rounded-full p-1 disabled:opacity-60"
                    onClick={() => {
                      setImages((current) =>
                        current.filter((_, imageIndex) => imageIndex !== index),
                      );
                      setPhotoImportError(null);
                    }}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
              {images.length < MAX_RECIPE_IMPORT_IMAGES && (
                <button
                  type="button"
                  aria-label="Add another recipe page"
                  disabled={isPreparingOrImportingImages}
                  className="border-border text-muted-foreground hover:bg-accent flex h-36 w-28 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-xs font-medium disabled:opacity-60"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Plus className="size-5" />
                  Add page
                </button>
              )}
            </div>
          )}

          {preparingImages && (
            <div className="text-muted-foreground flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm">
              <Loader2 className="size-4 animate-spin" />
              Preparing your photos…
            </div>
          )}

          {importFromImagesMutation.isPending && (
            <div className="text-muted-foreground flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm">
              <Loader2 className="size-4 animate-spin" />
              {photoLoadingCopy[photoLoadingStep]}
            </div>
          )}

          {photoImportError ? (
            <div className="space-y-3 rounded-md border border-[hsl(18_60%_80%)] bg-[hsl(40_33%_95%)] p-3">
              <p className="text-foreground text-sm">{photoImportErrorCopy}</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  disabled={isPreparingOrImportingImages}
                  onClick={() => {
                    setImages([]);
                    setPhotoImportError(null);
                    fileInputRef.current?.click();
                  }}
                >
                  <Camera />
                  Retake photos
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={isPreparingOrImportingImages}
                  onClick={() => {
                    setPhotoImportError(null);
                    setMode("manual");
                  }}
                >
                  Type it manually
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                type="button"
                disabled={images.length === 0 || isPreparingOrImportingImages}
                onClick={submitImageImport}
              >
                {importFromImagesMutation.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Wand2 />
                )}
                Read recipe
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={isPreparingOrImportingImages}
                onClick={backToChoose}
              >
                Back
              </Button>
            </div>
          )}
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
                {urlImportPending ? (
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
              {
                (isYouTubeVideoUrl(submittedUrl)
                  ? youtubeLoadingCopy
                  : loadingCopy)[loadingStep]
              }
            </div>
          )}

          {importError && (
            <div className="space-y-4 rounded-md border border-[hsl(18_60%_80%)] bg-[hsl(40_33%_95%)] p-3">
              <p className="text-foreground text-sm">
                {importError.code === "NO_RECIPE_FOUND" && importError.isYouTube
                  ? YOUTUBE_NO_RECIPE_FOUND_MESSAGE
                  : importErrorMessages[importError.code]}
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
