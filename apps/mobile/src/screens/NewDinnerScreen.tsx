import { useLayoutEffect, useRef } from "react";
import { ActivityIndicator, Alert, Pressable, Text } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import {
  RecipeEditor,
  dinnerFromEditorValues,
  type RecipeEditorHandle,
  type RecipeEditorValues,
} from "../components/dinners/RecipeEditor";
import { api } from "../utils/api";
import { colors } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "NewDinner">;

export function NewDinnerScreen({ navigation }: Props) {
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

  useLayoutEffect(() => {
    navigation.setOptions({
      title: "New dinner",
      headerBackVisible: false,
      gestureEnabled: false,
      headerLeft: () => (
        <Pressable
          accessibilityRole="button"
          className="min-h-11 justify-center pr-3"
          onPress={() => navigation.goBack()}
        >
          <Text className="text-muted-foreground text-sm font-semibold">
            Cancel
          </Text>
        </Pressable>
      ),
      headerRight: () => (
        <Pressable
          accessibilityRole="button"
          disabled={createMutation.isPending}
          className="bg-primary min-h-9 min-w-[58px] items-center justify-center rounded-lg px-3"
          onPress={() => editorRef.current?.submit()}
        >
          {createMutation.isPending ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <Text className="text-primary-foreground text-sm font-semibold">
              Save
            </Text>
          )}
        </Pressable>
      ),
    });
  }, [createMutation.isPending, navigation]);

  const createDinner = (values: RecipeEditorValues) => {
    createMutation.mutate(dinnerFromEditorValues(values));
  };

  return (
    <RecipeEditor
      ref={editorRef}
      isPending={createMutation.isPending}
      onCancel={() => navigation.goBack()}
      onSave={createDinner}
    />
  );
}
