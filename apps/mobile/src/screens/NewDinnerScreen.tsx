import { useLayoutEffect, useRef, useState } from "react";
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
import { Camera, ChefHat, Images, Link2, Trash2 } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import type { RecipeDraft } from "@planeatrepeat/shared";
import type { RootStackParamList } from "../navigation/RootNavigator";
import {
  RecipeEditor,
  dinnerFromEditorValues,
  type RecipeEditorHandle,
  type RecipeEditorValues,
} from "../components/dinners/RecipeEditor";
import { Button } from "../components/ui/Button";
import { Card, CardContent } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Textarea } from "../components/ui/Textarea";
import { api } from "../utils/api";
import { colors } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "NewDinner">;
type Mode = "choose" | "manual" | "link" | "photo" | "draft";
type PreparedImage = { uri: string; data: string; mimeType: "image/jpeg" };

export function NewDinnerScreen({ navigation }: Props) {
  const [mode, setMode] = useState<Mode>("choose");
  const [url, setUrl] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [draft, setDraft] = useState<RecipeDraft>();
  const [images, setImages] = useState<PreparedImage[]>([]);
  const [preparingImages, setPreparingImages] = useState(false);
  const editorRef = useRef<RecipeEditorHandle>(null);
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
  const importFromImages = api.dinner.importFromImages.useMutation({
    onSuccess: (result) => {
      setDraft(result);
      setMode("draft");
    },
  });

  const editing = mode === "manual" || mode === "draft";
  const isPending =
    createMutation.isPending ||
    importFromUrl.isPending ||
    importFromText.isPending ||
    importFromImages.isPending ||
    preparingImages;

  useLayoutEffect(() => {
    navigation.setOptions({
      title:
        mode === "link"
          ? "Import from link"
          : mode === "photo"
            ? "Import from photos"
            : "New dinner",
      headerBackVisible: false,
      gestureEnabled: false,
      headerLeft: () => (
        <Pressable
          accessibilityRole="button"
          className="min-h-11 justify-center pr-3"
          onPress={() => {
            if (editing) {
              editorRef.current?.cancel();
            } else if (mode === "choose") {
              navigation.goBack();
            } else {
              setMode("choose");
            }
          }}
        >
          <Text className="text-muted-foreground text-sm font-semibold">
            {mode === "choose" ? "Cancel" : "Back"}
          </Text>
        </Pressable>
      ),
      headerRight: editing
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
  }, [createMutation.isPending, editing, mode, navigation]);

  const createDinner = (values: RecipeEditorValues) => {
    createMutation.mutate(dinnerFromEditorValues(values));
  };

  const leaveEditor = () => {
    setDraft(undefined);
    setMode("choose");
  };

  if (editing) {
    return (
      <RecipeEditor
        key={mode}
        ref={editorRef}
        draft={draft}
        isPending={createMutation.isPending}
        onCancel={leaveEditor}
        onSave={createDinner}
      />
    );
  }

  if (mode === "link") {
    const importError = importFromUrl.error ?? importFromText.error;
    const showPasteFallback =
      !!importFromUrl.error &&
      ["FETCH_FAILED", "NO_RECIPE_FOUND"].includes(
        importFromUrl.error.data?.importErrorCode ?? "",
      );
    const isYouTube = /(?:youtube\.com|youtu\.be)/i.test(url);

    return (
      <ScrollView
        className="bg-background flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, gap: 16 }}
      >
        <View className="gap-2">
          <Text className="text-foreground text-sm font-semibold">
            Recipe link
          </Text>
          <Input
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="https://…"
            editable={!isPending}
          />
        </View>
        <Button
          disabled={!url.trim() || isPending}
          onPress={() => importFromUrl.mutate({ url: url.trim() })}
        >
          {importFromUrl.isPending ? (
            <>
              <ActivityIndicator color={colors.primaryForeground} />
              <Text className="text-primary-foreground text-sm font-semibold">
                {isYouTube
                  ? "Reading description and captions…"
                  : "Reading and structuring recipe…"}
              </Text>
            </>
          ) : (
            "Import recipe"
          )}
        </Button>

        {importError && (
          <Text className="text-destructive text-sm">
            {importError.message}
          </Text>
        )}

        {showPasteFallback && (
          <View className="border-border gap-3 border-t pt-4">
            <View className="gap-1">
              <Text className="text-foreground font-semibold">
                Paste the recipe instead
              </Text>
              <Text className="text-muted-foreground text-sm">
                Copy the ingredients and method from the page.
              </Text>
            </View>
            <Textarea
              value={pastedText}
              onChangeText={setPastedText}
              placeholder="Paste ingredients and instructions"
              editable={!isPending}
            />
            <Button
              variant="secondary"
              disabled={pastedText.trim().length < 50 || isPending}
              onPress={() => importFromText.mutate({ text: pastedText.trim() })}
            >
              {importFromText.isPending
                ? "Structuring recipe…"
                : "Structure pasted recipe"}
            </Button>
          </View>
        )}
      </ScrollView>
    );
  }

  if (mode === "photo") {
    return (
      <ScrollView
        className="bg-background flex-1"
        contentContainerStyle={{ padding: 16, gap: 16 }}
      >
        <View className="gap-1">
          <Text className="text-foreground font-serif text-2xl">
            Photograph the recipe
          </Text>
          <Text className="text-muted-foreground text-sm">
            Add up to four clear pages. Check for blur and glare before
            importing.
          </Text>
        </View>

        <View className="flex-row gap-3">
          <Button
            className="flex-1"
            variant="outline"
            disabled={images.length >= 4 || isPending}
            onPress={() => void addFromCamera()}
          >
            <Camera size={18} color={colors.foreground} />
            <Text className="text-foreground text-sm font-semibold">
              Camera
            </Text>
          </Button>
          <Button
            className="flex-1"
            variant="outline"
            disabled={images.length >= 4 || isPending}
            onPress={() => void addFromLibrary()}
          >
            <Images size={18} color={colors.foreground} />
            <Text className="text-foreground text-sm font-semibold">
              Library
            </Text>
          </Button>
        </View>

        <View className="flex-row flex-wrap gap-3">
          {images.map((image, index) => (
            <View key={`${image.uri}-${index}`} className="relative">
              <Image
                source={{ uri: image.uri }}
                className="border-border h-32 w-24 rounded-lg border"
                resizeMode="cover"
              />
              <Pressable
                accessibilityLabel={`Remove photo ${index + 1}`}
                className="bg-destructive absolute -right-2 -top-2 rounded-full p-1.5"
                onPress={() =>
                  setImages((current) =>
                    current.filter((_, imageIndex) => imageIndex !== index),
                  )
                }
              >
                <Trash2 size={14} color={colors.destructiveForeground} />
              </Pressable>
            </View>
          ))}
        </View>

        {importFromImages.error && (
          <Text className="text-destructive text-sm">
            {importFromImages.error.message} Retake photos with even light and
            sharp text.
          </Text>
        )}

        <Button
          disabled={images.length === 0 || isPending}
          onPress={() =>
            importFromImages.mutate({
              images: images.map(({ data, mimeType }) => ({
                data,
                mimeType,
              })),
            })
          }
        >
          {preparingImages
            ? "Preparing photos…"
            : importFromImages.isPending
              ? "Reading and combining pages…"
              : `Import ${images.length === 1 ? "photo" : `${images.length} photos`}`}
        </Button>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      className="bg-background flex-1"
      contentContainerStyle={{ padding: 16, gap: 12 }}
    >
      <View className="mb-2 gap-1">
        <Text className="text-foreground font-serif text-2xl">
          How would you like to start?
        </Text>
        <Text className="text-muted-foreground text-sm">
          Every import opens as a draft for you to review.
        </Text>
      </View>
      <ImportChoice
        icon={<Link2 size={22} color={colors.primary} />}
        title="Import from link"
        description="Recipe sites and YouTube videos"
        onPress={() => setMode("link")}
      />
      <ImportChoice
        icon={<Camera size={22} color={colors.primary} />}
        title="Import from photos"
        description="Photograph one or more cookbook pages"
        onPress={() => setMode("photo")}
      />
      <ImportChoice
        icon={<ChefHat size={22} color={colors.primary} />}
        title="Create manually"
        description="Add the recipe details yourself"
        onPress={() => setMode("manual")}
      />
    </ScrollView>
  );

  async function addFromCamera() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Camera access needed",
        "Allow camera access to photograph a recipe.",
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 1,
    });
    if (!result.canceled) await prepareAssets(result.assets);
  }

  async function addFromLibrary() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Photo access needed",
        "Allow photo access to choose recipe pages.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: 4 - images.length,
      quality: 1,
    });
    if (!result.canceled) await prepareAssets(result.assets);
  }

  async function prepareAssets(assets: ImagePicker.ImagePickerAsset[]) {
    setPreparingImages(true);
    try {
      const prepared = await Promise.all(
        assets.slice(0, 4 - images.length).map(async (asset) => {
          const longestEdge = Math.max(asset.width, asset.height);
          const actions =
            longestEdge > 1800
              ? [
                  {
                    resize:
                      asset.width >= asset.height
                        ? { width: 1800 }
                        : { height: 1800 },
                  },
                ]
              : [];
          const result = await manipulateAsync(asset.uri, actions, {
            compress: 0.7,
            format: SaveFormat.JPEG,
            base64: true,
          });
          if (!result.base64) throw new Error("Could not read photo data");
          return {
            uri: result.uri,
            data: result.base64,
            mimeType: "image/jpeg" as const,
          };
        }),
      );
      const combined = [...images, ...prepared];
      const totalSize = combined.reduce(
        (total, image) => total + image.data.length,
        0,
      );
      if (totalSize > 4_000_000) {
        Alert.alert(
          "Photos are too large",
          "Remove a page or retake the photos a little farther away.",
        );
        return;
      }
      setImages(combined);
    } catch (error) {
      Alert.alert(
        "Could not prepare photos",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setPreparingImages(false);
    }
  }
}

function ImportChoice({
  icon,
  title,
  description,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <Card>
        <CardContent className="flex-row items-start gap-3 p-5">
          {icon}
          <View className="flex-1 gap-1">
            <Text className="text-foreground font-semibold">{title}</Text>
            <Text className="text-muted-foreground text-sm">{description}</Text>
          </View>
        </CardContent>
      </Card>
    </Pressable>
  );
}
