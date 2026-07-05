import { useLayoutEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { recipeSchema } from "@planeatrepeat/shared";
import type { RootStackParamList } from "../navigation/RootNavigator";
import {
  RecipeEditor,
  type RecipeEditorHandle,
  type RecipeEditorValues,
} from "../components/dinners/RecipeEditor";
import { RecipeView } from "../components/dinners/RecipeView";
import { Button } from "../components/ui/Button";
import { api } from "../utils/api";
import { colors } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "DinnerDetail">;

const textOrNull = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export function DinnerDetailScreen({ navigation, route }: Props) {
  const { dinnerId } = route.params;
  const [editing, setEditing] = useState(false);
  const editorRef = useRef<RecipeEditorHandle>(null);
  const utils = api.useUtils();

  const dinnerQuery = api.dinner.get.useQuery({ dinnerId });
  const editMutation = api.dinner.edit.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.dinner.get.invalidate({ dinnerId }),
        utils.dinner.dinners.invalidate(),
        utils.dinner.ingredientNames.invalidate(),
      ]);
      setEditing(false);
    },
    onError: (error) => {
      Alert.alert("Could not save dinner", error.message);
    },
  });
  const deleteMutation = api.dinner.delete.useMutation({
    onSuccess: async () => {
      setEditing(false);
      await utils.dinner.dinners.invalidate();
      navigation.goBack();
    },
    onError: (error) => {
      Alert.alert("Could not delete dinner", error.message);
    },
  });
  const isPending = editMutation.isPending || deleteMutation.isPending;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: editing ? "Edit recipe" : "Dinner",
      headerBackVisible: !editing,
      gestureEnabled: !editing,
      headerLeft: editing
        ? () => (
            <Pressable
              accessibilityRole="button"
              className="min-h-11 justify-center pr-3"
              onPress={() => editorRef.current?.cancel()}
            >
              <Text className="text-muted-foreground text-sm font-semibold">
                Cancel
              </Text>
            </Pressable>
          )
        : undefined,
      headerRight: dinnerQuery.data?.dinner
        ? () =>
            editing ? (
              <Pressable
                accessibilityRole="button"
                disabled={isPending}
                className="bg-primary min-h-9 min-w-[58px] items-center justify-center rounded-lg px-3"
                onPress={() => editorRef.current?.submit()}
              >
                {isPending ? (
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
            ) : (
              <Pressable
                accessibilityRole="button"
                className="min-h-11 justify-center pl-3"
                onPress={() => setEditing(true)}
              >
                <Text className="text-muted-foreground text-sm font-semibold">
                  Edit
                </Text>
              </Pressable>
            )
        : undefined,
    });
  }, [dinnerQuery.data?.dinner, editing, isPending, navigation]);

  if (dinnerQuery.isPending) {
    return (
      <View className="bg-background flex-1 items-center justify-center">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (dinnerQuery.isError || !dinnerQuery.data?.dinner) {
    return (
      <View className="bg-background flex-1 items-center justify-center gap-4 px-6">
        <Text className="text-foreground font-serif text-2xl">
          Dinner not found
        </Text>
        <Button variant="outline" onPress={() => navigation.goBack()}>
          Back to dinners
        </Button>
      </View>
    );
  }

  const dinner = dinnerQuery.data.dinner;

  const save = (values: RecipeEditorValues) => {
    const recipe = recipeSchema.parse({
      servings:
        values.recipe.parts.length === 0 ? null : values.recipe.servings,
      parts: values.recipe.parts.map((part) => ({
        name: textOrNull(part.name),
        ingredients: part.ingredients.map((ingredient) => ({
          name: ingredient.name,
          amount: ingredient.amount,
          unit: ingredient.unit,
          note: textOrNull(ingredient.note),
        })),
        steps: part.steps.map((step) => step.text),
      })),
    });

    editMutation.mutate({
      dinnerId: dinner.id,
      dinnerName: values.name,
      tagList: values.tags,
      link: textOrNull(values.link),
      notes: textOrNull(values.notes),
      recipe,
    });
  };

  if (editing) {
    return (
      <RecipeEditor
        ref={editorRef}
        dinner={dinner}
        isPending={isPending}
        onCancel={() => setEditing(false)}
        onSave={save}
        onDelete={() => deleteMutation.mutate({ dinnerId: dinner.id })}
      />
    );
  }

  return <RecipeView dinner={dinner} onEdit={() => setEditing(true)} />;
}
