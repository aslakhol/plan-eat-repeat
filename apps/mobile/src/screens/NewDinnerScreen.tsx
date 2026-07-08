import {
  type ReactNode,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Link as LinkIcon, Pencil, Wand2 } from "lucide-react-native";
import type { RootStackParamList } from "../navigation/RootNavigator";
import {
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
type CreateMode = "choose" | "manual" | "import" | "draft";
type ImportErrorCode =
  | "FETCH_FAILED"
  | "SITE_BLOCKED"
  | "PAGE_UNREADABLE"
  | "NO_RECIPE_FOUND"
  | "EXTRACTION_FAILED";

const loadingCopy = [
  "Fetching the page",
  "Looking for structured recipe data",
  "Normalizing ingredients and steps",
];

export function NewDinnerScreen({ navigation }: Props) {
  const editorRef = useRef<RecipeEditorHandle>(null);
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
    onMutate: () => {
      setImportError(null);
      setLoadingStep(0);
      const interval = setInterval(() => {
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
      if (
        code === "FETCH_FAILED" ||
        code === "SITE_BLOCKED" ||
        code === "PAGE_UNREADABLE" ||
        code === "NO_RECIPE_FOUND"
      ) {
        setShowPasteFallback(true);
      }
    },
    onSettled: (_data, _error, _variables, context) => {
      if (context?.interval) {
        clearInterval(context.interval);
      }
    },
  });

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
      setImportError(importErrorCode(error.message));
    },
  });

  const cancelCurrent = useCallback(() => {
    if (mode === "draft") {
      setDraft(null);
      setMode("choose");
      return;
    }

    navigation.goBack();
  }, [mode, navigation]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: "New dinner",
      headerBackVisible: false,
      gestureEnabled: false,
      headerLeft: () => (
        <Pressable
          accessibilityRole="button"
          className="min-h-11 justify-center pr-3"
          onPress={cancelCurrent}
        >
          <Text className="text-muted-foreground text-sm font-semibold">
            Cancel
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
  }, [cancelCurrent, createMutation.isPending, mode, navigation]);

  const createDinner = (values: RecipeEditorValues) => {
    createMutation.mutate(dinnerFromEditorValues(values));
  };

  const submitUrlImport = () => {
    const sourceUrl = validUrlOrNull(url);
    if (!sourceUrl) {
      setImportError("FETCH_FAILED");
      return;
    }

    importFromUrlMutation.mutate({ url: sourceUrl });
  };

  const submitTextImport = () => {
    importFromTextMutation.mutate({ text: pasteText });
  };

  const isImporting =
    importFromUrlMutation.isPending || importFromTextMutation.isPending;

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
            onPress={() => setMode("manual")}
          >
            <Pencil size={18} color={colors.secondaryForeground} />
            <Text className="text-secondary-foreground text-sm font-semibold">
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
                {loadingCopy[loadingStep]}
              </Text>
            </View>
          )}

          {importError && (
            <View className="gap-4 rounded-md border border-[hsl(18,60%,80%)] bg-[hsl(40,33%,95%)] p-3">
              <Text className="text-foreground text-sm">
                {importErrorMessage(importError)}
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

  return (
    <RecipeEditor
      key={draftKey}
      ref={editorRef}
      initialValues={draft ?? undefined}
      showImportReview={mode === "draft"}
      importReviewSourceUrl={draft?.link}
      isPending={createMutation.isPending}
      onCancel={() => navigation.goBack()}
      onSave={createDinner}
    />
  );
}

const validUrlOrNull = (value: string) => {
  try {
    return new URL(value.trim()).toString();
  } catch {
    return null;
  }
};

const importErrorCode = (message: string): ImportErrorCode => {
  if (
    message === "FETCH_FAILED" ||
    message === "SITE_BLOCKED" ||
    message === "PAGE_UNREADABLE" ||
    message === "NO_RECIPE_FOUND" ||
    message === "EXTRACTION_FAILED"
  ) {
    return message;
  }

  return "EXTRACTION_FAILED";
};

const importErrorMessage = (code: ImportErrorCode) => {
  if (code === "FETCH_FAILED") {
    return "We couldn't open that link. Double-check the URL, or paste the recipe text below.";
  }
  if (code === "SITE_BLOCKED") {
    return "This site blocks automated requests, so we couldn't read it. Paste the recipe text below and we'll structure it for you.";
  }
  if (code === "PAGE_UNREADABLE") {
    return "We couldn't read this page automatically — some sites build their recipe with JavaScript, so there's nothing on the page for us to grab. Paste the recipe text below and we'll structure it for you.";
  }
  if (code === "NO_RECIPE_FOUND") {
    return "We opened the page but couldn't find a recipe on it. If there is one, paste the text below.";
  }
  return "We couldn't turn that source into a recipe. Try pasting the recipe text below.";
};

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <Text className="text-muted-foreground text-[11px] font-bold uppercase tracking-[0.1em]">
      {children}
    </Text>
  );
}
