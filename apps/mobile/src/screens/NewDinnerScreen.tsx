import { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  Camera,
  Images,
  Link as LinkIcon,
  Pencil,
  Plus,
  RotateCcw,
  Wand2,
  X,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import {
  MAX_RECIPE_IMPORT_IMAGE_DATA_LENGTH,
  MAX_RECIPE_IMPORT_IMAGES,
  YOUTUBE_NO_RECIPE_FOUND_MESSAGE,
  type ImportRecipeErrorCode,
  isYouTubeVideoUrl,
  importErrorMessages,
  validUrlOrNull,
} from "@planeatrepeat/shared";
import type { RootStackParamList } from "../navigation/RootNavigator";
import {
  FieldLabel,
  RecipeEditor,
  dinnerFromEditorValues,
  editorValuesFromRecipeInput,
  type RecipeEditorHandle,
  type RecipeEditorValues,
} from "../components/dinners/RecipeEditor";
import { api } from "../utils/api";
import { colors } from "../theme/colors";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Textarea } from "../components/ui/Textarea";

type Props = NativeStackScreenProps<RootStackParamList, "NewDinner">;
type CreateMode = "choose" | "manual" | "import" | "photos" | "draft";
type PreparedImage = { uri: string; data: string; mimeType: "image/jpeg" };
type PhotoCaptureOptions = { replaceIndex?: number; reset?: boolean };
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

export function NewDinnerScreen({ navigation }: Props) {
  const editorRef = useRef<RecipeEditorHandle>(null);
  const [mode, setMode] = useState<CreateMode>("choose");
  const [url, setUrl] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [importError, setImportError] = useState<ImportFailure | null>(null);
  const [showPasteFallback, setShowPasteFallback] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [draft, setDraft] = useState<RecipeEditorValues | null>(null);
  const [images, setImages] = useState<PreparedImage[]>([]);
  const [preparingImages, setPreparingImages] = useState(false);
  const [photoLoadingStep, setPhotoLoadingStep] = useState(0);
  const [photoImportError, setPhotoImportError] =
    useState<ImportRecipeErrorCode | null>(null);
  const utils = api.useUtils();
  const createMutation = api.dinner.create.useMutation({
    onSuccess: async (result) => {
      await Promise.all([
        utils.dinner.dinners.invalidate(),
        utils.dinner.tags.invalidate(),
        utils.dinner.ingredientNames.invalidate(),
      ]);
      navigation.replace("DinnerDetail", { dinnerId: result.dinner.id });
    },
    onError: (error) => {
      Alert.alert("Could not save dinner", error.message);
    },
  });

  const importFromUrlMutation = api.dinner.importFromUrl.useMutation({
    onMutate: ({ url: sourceUrl }) => {
      const isYouTube = isYouTubeVideoUrl(sourceUrl);
      const steps = isYouTube ? youtubeLoadingCopy : loadingCopy;
      setImportError(null);
      setLoadingStep(0);
      const interval = setInterval(() => {
        setLoadingStep((current) => Math.min(current + 1, steps.length - 1));
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
    onError: (error, variables) => {
      setImportError({
        code: error.data?.importErrorCode ?? "EXTRACTION_FAILED",
        isYouTube: isYouTubeVideoUrl(variables.url),
      });
      setShowPasteFallback(true);
    },
    onSettled: (_data, _error, _variables, context) => {
      if (context?.interval) {
        clearInterval(context.interval);
      }
    },
  });

  const submittedSourceIsYouTube = isYouTubeVideoUrl(
    importFromUrlMutation.variables?.url ?? "",
  );

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
      const interval = setInterval(() => {
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
        clearInterval(context.interval);
      }
    },
  });

  const isImporting =
    importFromUrlMutation.isPending || importFromTextMutation.isPending;
  const isPreparingOrImportingImages =
    preparingImages || importFromImagesMutation.isPending;
  const isCurrentModeBusy =
    (mode === "import" && isImporting) ||
    (mode === "photos" && isPreparingOrImportingImages);

  const cancelCurrent = useCallback(() => {
    if (isCurrentModeBusy) return;

    if (mode === "draft") {
      setDraft(null);
      setMode("choose");
      return;
    }

    if (mode === "import" || mode === "photos") {
      setImportError(null);
      setShowPasteFallback(false);
      setPhotoImportError(null);
      setMode("choose");
      return;
    }

    navigation.goBack();
  }, [isCurrentModeBusy, mode, navigation]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: mode === "photos" ? "Import from photo" : "New dinner",
      headerBackVisible: false,
      gestureEnabled: false,
      headerLeft: () => (
        <Pressable
          accessibilityRole="button"
          disabled={isCurrentModeBusy}
          className={`min-h-11 justify-center pr-3${
            isCurrentModeBusy ? " opacity-60" : ""
          }`}
          onPress={cancelCurrent}
        >
          <Text className="text-muted-foreground text-sm font-semibold">
            {mode === "choose" || mode === "manual" ? "Cancel" : "Back"}
          </Text>
        </Pressable>
      ),
      headerRight:
        mode === "manual" || mode === "draft"
          ? () => (
              <Pressable
                accessibilityRole="button"
                disabled={createMutation.isPending}
                className="bg-primary min-h-9 min-w-[58px] items-center justify-center rounded-lg px-3"
                onPress={() => editorRef.current?.submit()}
              >
                {createMutation.isPending ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.primaryForeground}
                  />
                ) : (
                  <Text className="text-primary-foreground text-sm font-semibold">
                    Save
                  </Text>
                )}
              </Pressable>
            )
          : undefined,
    });
  }, [
    cancelCurrent,
    createMutation.isPending,
    isCurrentModeBusy,
    mode,
    navigation,
  ]);

  const createDinner = (values: RecipeEditorValues) => {
    createMutation.mutate(dinnerFromEditorValues(values));
  };

  const submitUrlImport = () => {
    const sourceUrl = validUrlOrNull(url);
    if (!sourceUrl) {
      setImportError({ code: "FETCH_FAILED", isYouTube: false });
      setShowPasteFallback(true);
      return;
    }

    importFromUrlMutation.mutate({ url: sourceUrl });
  };

  const submitTextImport = () => {
    importFromTextMutation.mutate({ text: pasteText });
  };

  const preparePhotoAssets = async (
    assets: ImagePicker.ImagePickerAsset[],
    { replaceIndex, reset = false }: PhotoCaptureOptions = {},
  ) => {
    setPreparingImages(true);

    try {
      const availableSlots =
        reset || replaceIndex !== undefined
          ? 1
          : MAX_RECIPE_IMPORT_IMAGES - images.length;
      const prepared = await Promise.all(
        assets.slice(0, availableSlots).map(async (asset) => {
          const longestEdge = Math.max(asset.width, asset.height);
          const actions =
            longestEdge > PHOTO_LONGEST_EDGE
              ? [
                  {
                    resize:
                      asset.width >= asset.height
                        ? { width: PHOTO_LONGEST_EDGE }
                        : { height: PHOTO_LONGEST_EDGE },
                  },
                ]
              : [];
          const result = await manipulateAsync(asset.uri, actions, {
            base64: true,
            compress: PHOTO_COMPRESSION,
            format: SaveFormat.JPEG,
          });

          if (!result.base64) {
            throw new Error("Could not read that photo.");
          }

          return {
            uri: result.uri,
            data: result.base64,
            mimeType: "image/jpeg" as const,
          };
        }),
      );

      if (prepared.length === 0) return;

      const nextImages = reset
        ? prepared
        : replaceIndex === undefined
          ? [...images, ...prepared]
          : images.map((image, index) =>
              index === replaceIndex ? prepared[0]! : image,
            );
      const totalDataLength = nextImages.reduce(
        (total, image) => total + image.data.length,
        0,
      );

      if (totalDataLength > MAX_RECIPE_IMPORT_IMAGE_DATA_LENGTH) {
        Alert.alert(
          "Photos are too large",
          "Remove a page or retake the photos a little farther away.",
        );
        return;
      }

      setImages(nextImages);
      setPhotoImportError(null);
    } catch (error) {
      Alert.alert(
        "Could not prepare photos",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setPreparingImages(false);
    }
  };

  const capturePhoto = async (options: PhotoCaptureOptions = {}) => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Camera access needed",
        "Allow camera access to photograph a recipe.",
      );
      return;
    }

    let result: ImagePicker.ImagePickerResult;
    try {
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 1,
      });
    } catch (error) {
      Alert.alert(
        "Camera unavailable",
        error instanceof Error ? error.message : "Please try again.",
      );
      return;
    }
    if (!result.canceled) {
      await preparePhotoAssets(result.assets, options);
    }
  };

  const choosePhotos = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Photo access needed",
        "Allow photo access to choose recipe pages.",
      );
      return;
    }

    let result: ImagePicker.ImagePickerResult;
    try {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        quality: 1,
        selectionLimit: MAX_RECIPE_IMPORT_IMAGES - images.length,
      });
    } catch (error) {
      Alert.alert(
        "Photo library unavailable",
        error instanceof Error ? error.message : "Please try again.",
      );
      return;
    }
    if (!result.canceled) {
      await preparePhotoAssets(result.assets);
    }
  };

  const submitImageImport = () => {
    importFromImagesMutation.mutate({
      images: images.map(({ data, mimeType }) => ({ data, mimeType })),
    });
  };

  if (mode === "choose") {
    return (
      <View className="bg-background flex-1 px-4 pt-3">
        <View className="gap-3">
          <Button className="justify-start" onPress={() => setMode("import")}>
            <LinkIcon size={18} color={colors.primaryForeground} />
            <Text className="text-primary-foreground text-sm font-semibold">
              Import from link
            </Text>
          </Button>
          <Button
            variant="secondary"
            className="justify-start"
            onPress={() => setMode("photos")}
          >
            <Camera size={18} color={colors.secondaryForeground} />
            <Text className="text-secondary-foreground text-sm font-semibold">
              Import from photo
            </Text>
          </Button>
          <Button
            variant="outline"
            className="justify-start"
            onPress={() => setMode("manual")}
          >
            <Pencil size={18} color={colors.foreground} />
            <Text className="text-foreground text-sm font-semibold">
              Create manually
            </Text>
          </Button>
        </View>
      </View>
    );
  }

  if (mode === "import") {
    return (
      <ScrollView
        className="bg-background flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 48,
        }}
      >
        <View className="gap-5">
          <View className="gap-3">
            <View className="gap-1.5">
              <FieldLabel>Recipe link</FieldLabel>
              <Input
                value={url}
                editable={!isImporting}
                onChangeText={setUrl}
                autoCapitalize="none"
                keyboardType="url"
                className="h-12 bg-white"
                placeholder="https://"
              />
            </View>
            <View className="flex-row gap-2">
              <Button disabled={isImporting} onPress={submitUrlImport}>
                {importFromUrlMutation.isPending ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.primaryForeground}
                  />
                ) : (
                  <Wand2 size={18} color={colors.primaryForeground} />
                )}
                <Text className="text-primary-foreground text-sm font-semibold">
                  Import
                </Text>
              </Button>
              <Button
                variant="ghost"
                disabled={isImporting}
                onPress={() => {
                  setImportError(null);
                  setShowPasteFallback(false);
                  setMode("choose");
                }}
              >
                Back
              </Button>
            </View>
          </View>

          {isImporting && (
            <View className="border-border rounded-md border bg-white px-3 py-2">
              <Text className="text-muted-foreground text-sm">
                {
                  (submittedSourceIsYouTube ? youtubeLoadingCopy : loadingCopy)[
                    loadingStep
                  ]
                }
              </Text>
            </View>
          )}

          {importError && (
            <View className="gap-4 rounded-md border border-[hsl(18,60%,80%)] bg-[hsl(40,33%,95%)] p-3">
              <Text className="text-foreground text-sm">
                {importError.code === "NO_RECIPE_FOUND" && importError.isYouTube
                  ? YOUTUBE_NO_RECIPE_FOUND_MESSAGE
                  : importErrorMessages[importError.code]}
              </Text>
              {showPasteFallback && (
                <View className="gap-3">
                  <View className="gap-1.5">
                    <FieldLabel>Paste recipe text</FieldLabel>
                    <Textarea
                      value={pasteText}
                      editable={!isImporting}
                      onChangeText={setPasteText}
                      className="min-h-40 bg-white text-[15px]"
                    />
                  </View>
                  <Button
                    disabled={isImporting || pasteText.trim().length === 0}
                    onPress={submitTextImport}
                  >
                    {importFromTextMutation.isPending && (
                      <ActivityIndicator
                        size="small"
                        color={colors.primaryForeground}
                      />
                    )}
                    <Text className="text-primary-foreground text-sm font-semibold">
                      Import pasted recipe
                    </Text>
                  </Button>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    );
  }

  if (mode === "photos") {
    return (
      <ScrollView
        className="bg-background flex-1"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 48,
          gap: 20,
        }}
      >
        <View className="gap-1.5">
          <Text className="text-foreground font-serif text-2xl">
            Photograph the recipe
          </Text>
          <Text className="text-muted-foreground text-sm">
            Fill the frame with the page, avoid glare.
          </Text>
        </View>

        {images.length === 0 ? (
          <View className="gap-3">
            <Button
              disabled={isPreparingOrImportingImages}
              onPress={() => void capturePhoto()}
            >
              <Camera size={18} color={colors.primaryForeground} />
              <Text className="text-primary-foreground text-sm font-semibold">
                Take photo
              </Text>
            </Button>
            <Button
              variant="outline"
              disabled={isPreparingOrImportingImages}
              onPress={() => void choosePhotos()}
            >
              <Images size={18} color={colors.foreground} />
              <Text className="text-foreground text-sm font-semibold">
                Choose from library
              </Text>
            </Button>
          </View>
        ) : (
          <View className="gap-4">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12 }}
            >
              {images.map((image, index) => (
                <View key={image.uri} className="relative h-36 w-28">
                  <Image
                    source={{ uri: image.uri }}
                    className="border-border h-36 w-28 rounded-lg border"
                    resizeMode="cover"
                  />
                  <Pressable
                    accessibilityLabel={`Remove photo ${index + 1}`}
                    accessibilityRole="button"
                    disabled={isPreparingOrImportingImages}
                    className="bg-destructive absolute -right-2 -top-2 rounded-full p-1"
                    onPress={() => {
                      setImages((current) =>
                        current.filter((_, imageIndex) => imageIndex !== index),
                      );
                      setPhotoImportError(null);
                    }}
                  >
                    <X size={14} color={colors.destructiveForeground} />
                  </Pressable>
                  <Pressable
                    accessibilityLabel={`Retake photo ${index + 1}`}
                    accessibilityRole="button"
                    disabled={isPreparingOrImportingImages}
                    className="bg-background/95 absolute bottom-1 left-1 flex-row items-center gap-1 rounded px-1.5 py-1"
                    onPress={() => void capturePhoto({ replaceIndex: index })}
                  >
                    <RotateCcw size={12} color={colors.foreground} />
                    <Text className="text-foreground text-xs font-medium">
                      Retake
                    </Text>
                  </Pressable>
                </View>
              ))}
              {images.length < MAX_RECIPE_IMPORT_IMAGES && (
                <Pressable
                  accessibilityLabel="Add another recipe page"
                  accessibilityRole="button"
                  disabled={isPreparingOrImportingImages}
                  className="border-border h-36 w-28 items-center justify-center gap-2 rounded-lg border border-dashed"
                  onPress={() => void capturePhoto()}
                >
                  <Plus size={20} color={colors.mutedForeground} />
                  <Text className="text-muted-foreground text-xs font-medium">
                    Add page
                  </Text>
                </Pressable>
              )}
            </ScrollView>

            {images.length < MAX_RECIPE_IMPORT_IMAGES && (
              <Button
                variant="outline"
                disabled={isPreparingOrImportingImages}
                onPress={() => void choosePhotos()}
              >
                <Images size={18} color={colors.foreground} />
                <Text className="text-foreground text-sm font-semibold">
                  Add from library
                </Text>
              </Button>
            )}
          </View>
        )}

        {preparingImages && (
          <View className="border-border flex-row items-center gap-2 rounded-md border bg-white px-3 py-2">
            <ActivityIndicator size="small" color={colors.primary} />
            <Text className="text-muted-foreground text-sm">
              Preparing your photos…
            </Text>
          </View>
        )}

        {importFromImagesMutation.isPending && (
          <View className="border-border flex-row items-center gap-2 rounded-md border bg-white px-3 py-2">
            <ActivityIndicator size="small" color={colors.primary} />
            <Text className="text-muted-foreground text-sm">
              {photoLoadingCopy[photoLoadingStep]}
            </Text>
          </View>
        )}

        {photoImportError ? (
          <View className="gap-3 rounded-md border border-[hsl(18,60%,80%)] bg-[hsl(40,33%,95%)] p-3">
            <Text className="text-foreground text-sm">
              {photoImportErrorCopy}
            </Text>
            <Button
              disabled={isPreparingOrImportingImages}
              onPress={() => void capturePhoto({ reset: true })}
            >
              <Camera size={18} color={colors.primaryForeground} />
              <Text className="text-primary-foreground text-sm font-semibold">
                Retake photos
              </Text>
            </Button>
            <Button
              variant="ghost"
              disabled={isPreparingOrImportingImages}
              onPress={() => {
                setPhotoImportError(null);
                setMode("manual");
              }}
            >
              Type it manually
            </Button>
          </View>
        ) : (
          <Button
            disabled={images.length === 0 || isPreparingOrImportingImages}
            onPress={submitImageImport}
          >
            <Wand2 size={18} color={colors.primaryForeground} />
            <Text className="text-primary-foreground text-sm font-semibold">
              Read recipe
            </Text>
          </Button>
        )}
      </ScrollView>
    );
  }

  return (
    <RecipeEditor
      key={draft ? `${draft.name}-${draft.link}` : "manual"}
      ref={editorRef}
      initialValues={draft ?? undefined}
      showImportReview={mode === "draft"}
      isPending={createMutation.isPending}
      onCancel={() => navigation.goBack()}
      onSave={createDinner}
    />
  );
}
