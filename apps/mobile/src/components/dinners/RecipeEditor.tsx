import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Minus,
  Plus,
  Trash2,
  X,
} from "lucide-react-native";
import { format } from "date-fns";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, usePreventRemove } from "@react-navigation/native";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Controller,
  type UseFormReturn,
  useFieldArray,
  useForm,
} from "react-hook-form";
import {
  UNITS,
  type DinnerWithRecipe,
  amountInputSchema,
  dinnerNameSchema,
  parseAmount,
  recipeSchema,
  recipeIngredientSchema,
} from "@planeatrepeat/shared";
import { api } from "../../utils/api";
import { colors } from "../../theme/colors";
import { cn } from "../../utils/cn";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Textarea } from "../ui/Textarea";

const editorIngredientSchema = recipeIngredientSchema.extend({
  name: z.string().trim().min(1, "Name required"),
  amount: amountInputSchema,
  note: z.string(),
});

const recipeEditorSchema = z.object({
  name: dinnerNameSchema,
  tags: z.array(z.string()),
  newTag: z.string().optional(),
  link: z.union([z.literal(""), z.string().url("Enter a valid URL")]),
  notes: z.string(),
  recipe: z.object({
    servings: z.number().int().positive().nullable(),
    parts: z.array(
      z.object({
        name: z.string(),
        ingredients: z.array(editorIngredientSchema),
        steps: z.array(
          z.object({
            text: z.string().trim().min(1, "Add a step or remove this row"),
          }),
        ),
      }),
    ),
  }),
});

export type RecipeEditorValues = z.infer<typeof recipeEditorSchema>;

export type RecipeEditorHandle = {
  cancel: () => void;
  submit: () => void;
};

type Props = {
  dinner?: DinnerWithRecipe;
  initialValues?: RecipeEditorValues;
  showImportReview?: boolean;
  importReviewSourceUrl?: string | null;
  isPending: boolean;
  onCancel: () => void;
  onSave: (values: RecipeEditorValues) => void;
  onDelete?: () => void;
};

const emptyPart = (): RecipeEditorValues["recipe"]["parts"][number] => ({
  name: "",
  ingredients: [],
  steps: [],
});

const emptyEditorValues = (): RecipeEditorValues => ({
  name: "",
  tags: [],
  newTag: "",
  link: "",
  notes: "",
  recipe: {
    servings: null,
    parts: [],
  },
});

const editorIngredient = (ingredient: {
  name: string;
  amount: number | null;
  unit: string | null;
  note: string | null;
}) => ({
  name: ingredient.name,
  amount: ingredient.amount === null ? "" : String(ingredient.amount),
  unit: UNITS.find((unit) => unit === ingredient.unit) ?? null,
  note: ingredient.note ?? "",
});

export const editorValuesFromRecipeInput = (input: {
  name: string;
  recipe: z.infer<typeof recipeSchema>;
  link?: string | null;
}): RecipeEditorValues => ({
  name: input.name,
  tags: [],
  newTag: "",
  link: input.link ?? "",
  notes: "",
  recipe: {
    servings: input.recipe.servings,
    parts: input.recipe.parts.map((part) => ({
      name: part.name ?? "",
      ingredients: part.ingredients.map(editorIngredient),
      steps: part.steps.map((text) => ({ text })),
    })),
  },
});

const editorValuesFromDinner = (
  dinner: DinnerWithRecipe,
): RecipeEditorValues => ({
  name: dinner.name,
  tags: dinner.tags.map((tag) => tag.value),
  newTag: "",
  link: dinner.link ?? "",
  notes: dinner.notes ?? "",
  recipe: {
    servings: dinner.servings ?? null,
    parts: dinner.parts.map((part) => ({
      name: part.name ?? "",
      ingredients: part.ingredients.map(editorIngredient),
      steps: part.steps.map((step) => ({ text: step.text })),
    })),
  },
});

export const RecipeEditor = forwardRef<RecipeEditorHandle, Props>(
  function RecipeEditor(
    {
      dinner,
      initialValues,
      showImportReview = false,
      importReviewSourceUrl,
      isPending,
      onCancel,
      onSave,
      onDelete,
    },
    ref,
  ) {
    const form = useForm<RecipeEditorValues>({
      resolver: zodResolver(recipeEditorSchema),
      defaultValues:
        initialValues ??
        (dinner === undefined
          ? emptyEditorValues()
          : editorValuesFromDinner(dinner)),
    });
    const parts = useFieldArray({
      control: form.control,
      name: "recipe.parts",
    });
    const watchedParts = form.watch("recipe.parts");
    const servings = form.watch("recipe.servings");
    const navigation = useNavigation();
    const headerHeight = useHeaderHeight();
    const multiMode =
      watchedParts.length > 1 ||
      watchedParts.some((part) => part.name.trim().length > 0);
    const ingredientNamesQuery = api.dinner.ingredientNames.useQuery();

    // Disarm the guard while a save/delete is in flight so the goBack after a
    // successful delete isn't intercepted by the discard prompt.
    usePreventRemove(form.formState.isDirty && !isPending, ({ data }) => {
      Alert.alert(
        "Discard changes?",
        "Your unsaved recipe changes will be lost.",
        [
          { text: "Keep editing", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => navigation.dispatch(data.action),
          },
        ],
      );
    });

    const cancel = () => {
      if (!form.formState.isDirty) {
        onCancel();
        return;
      }

      Alert.alert(
        "Discard changes?",
        "Your unsaved recipe changes will be lost.",
        [
          { text: "Keep editing", style: "cancel" },
          { text: "Discard", style: "destructive", onPress: onCancel },
        ],
      );
    };

    useImperativeHandle(
      ref,
      () => ({
        cancel,
        submit: () => void form.handleSubmit(onSave)(),
      }),
      [form, onSave],
    );

    return (
      <KeyboardAvoidingView
        className="bg-background flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? headerHeight : 0}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 48,
          }}
        >
          <View className="gap-5">
            {showImportReview && (
              <View className="border-[hsl(18,60%,80%)] bg-[hsl(40,33%,95%)] rounded-md border px-3 py-2">
                <Text className="text-foreground text-sm font-semibold">
                  {importReviewSourceUrl
                    ? `Imported from ${sourceLabel(importReviewSourceUrl)}`
                    : "Imported recipe draft"}
                </Text>
                <Text className="text-muted-foreground text-sm">
                  Check the details, then save.
                </Text>
              </View>
            )}

            <View className="gap-4">
              <View className="gap-1.5">
                <FieldLabel>Name</FieldLabel>
                <Controller
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <Input
                      value={field.value}
                      onBlur={field.onBlur}
                      onChangeText={field.onChange}
                      accessibilityLabel="Dinner name"
                      className="h-12 bg-white text-lg font-semibold"
                    />
                  )}
                />
                <FieldError message={form.formState.errors.name?.message} />
              </View>

              <View>
                <View className="flex-row gap-2">
                  <View className="gap-1.5">
                    <FieldLabel>Servings</FieldLabel>
                    <View className="border-border h-11 w-[116px] flex-row overflow-hidden rounded-md border bg-white">
                      <Pressable
                        accessibilityLabel="Decrease servings"
                        className="border-border w-9 items-center justify-center border-r"
                        onPress={() =>
                          form.setValue(
                            "recipe.servings",
                            Math.max(1, (servings ?? 2) - 1),
                            { shouldDirty: true },
                          )
                        }
                      >
                        <Minus size={16} color={colors.mutedForeground} />
                      </Pressable>
                      <Controller
                        control={form.control}
                        name="recipe.servings"
                        render={({ field }) => (
                          <Input
                            value={
                              field.value === null ? "" : String(field.value)
                            }
                            onBlur={field.onBlur}
                            onChangeText={(value) =>
                              field.onChange(
                                value === "" ? null : Number(value),
                              )
                            }
                            accessibilityLabel="Number of servings"
                            keyboardType="number-pad"
                            textAlign="center"
                            className="min-w-0 flex-1 rounded-none border-0 bg-transparent px-0 py-0 font-bold"
                            placeholder="–"
                          />
                        )}
                      />
                      <Pressable
                        accessibilityLabel="Increase servings"
                        className="border-border w-9 items-center justify-center border-l"
                        onPress={() =>
                          form.setValue(
                            "recipe.servings",
                            (servings ?? 0) + 1,
                            {
                              shouldDirty: true,
                            },
                          )
                        }
                      >
                        <Plus size={16} color={colors.mutedForeground} />
                      </Pressable>
                    </View>
                  </View>

                  <View className="min-w-0 flex-1 gap-1.5">
                    <FieldLabel>Recipe link</FieldLabel>
                    <Controller
                      control={form.control}
                      name="link"
                      render={({ field }) => (
                        <Input
                          value={field.value}
                          onBlur={field.onBlur}
                          onChangeText={field.onChange}
                          accessibilityLabel="Recipe link"
                          autoCapitalize="none"
                          keyboardType="url"
                          className="h-11 bg-white"
                        />
                      )}
                    />
                  </View>
                </View>
                <FieldError
                  message={
                    form.formState.errors.link?.message ??
                    form.formState.errors.recipe?.servings?.message
                  }
                />
              </View>

              <View className="gap-1.5">
                <FieldLabel>Tags</FieldLabel>
                <EditorTags form={form} />
              </View>
            </View>

            <View className="border-t border-[hsl(40,15%,86%)] pt-5">
              {parts.fields.map((part, partIndex) => (
                <PartEditor
                  key={part.id}
                  form={form}
                  partIndex={partIndex}
                  multiMode={multiMode}
                  ingredientNames={
                    ingredientNamesQuery.data?.ingredientNames ?? []
                  }
                  canMoveUp={partIndex > 0}
                  canMoveDown={partIndex < parts.fields.length - 1}
                  onMoveUp={() => parts.move(partIndex, partIndex - 1)}
                  onMoveDown={() => parts.move(partIndex, partIndex + 1)}
                  onRemove={() => parts.remove(partIndex)}
                />
              ))}

              <Button
                variant="secondary"
                className="mt-4 w-full"
                onPress={() => parts.append(emptyPart())}
              >
                <Plus size={17} color={colors.primary} />
                <Text className="text-primary font-serif text-sm">
                  {parts.fields.length === 0 ? "Add recipe" : "Add part"}
                </Text>
              </Button>
            </View>

            <View className="gap-2 border-t border-[hsl(40,15%,86%)] pt-5">
              <SectionLabel>Notes</SectionLabel>
              <Controller
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <Textarea
                    value={field.value}
                    onBlur={field.onBlur}
                    onChangeText={field.onChange}
                    className="min-h-24 bg-white text-[15px]"
                    placeholder="Anything useful to remember next time"
                  />
                )}
              />
            </View>

            {dinner && onDelete && (
              <DeleteDinnerButton
                dinnerId={dinner.id}
                isPending={isPending}
                onDelete={onDelete}
              />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  },
);

export const dinnerFromEditorValues = (values: RecipeEditorValues) => ({
  dinnerName: values.name,
  tagList: values.tags,
  link: textOrNull(values.link),
  notes: textOrNull(values.notes),
  recipe: recipeFromEditorValues(values),
});

const recipeFromEditorValues = (values: RecipeEditorValues) =>
  recipeSchema.parse({
    servings: values.recipe.parts.length === 0 ? null : values.recipe.servings,
    parts: values.recipe.parts.map((part) => ({
      name: textOrNull(part.name),
      ingredients: part.ingredients.map((ingredient) => ({
        name: ingredient.name,
        amount: parseAmount(ingredient.amount),
        unit: ingredient.unit,
        note: textOrNull(ingredient.note),
      })),
      steps: part.steps.map((step) => step.text),
    })),
  });

const textOrNull = (value: string | undefined) => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed;
};

const sourceLabel = (sourceUrl: string) => {
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    return sourceUrl;
  }
};

type PartEditorProps = {
  form: UseFormReturn<RecipeEditorValues>;
  partIndex: number;
  multiMode: boolean;
  ingredientNames: string[];
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
};

function PartEditor({
  form,
  partIndex,
  multiMode,
  ingredientNames,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onRemove,
}: PartEditorProps) {
  const ingredients = useFieldArray({
    control: form.control,
    name: `recipe.parts.${partIndex}.ingredients`,
  });
  const steps = useFieldArray({
    control: form.control,
    name: `recipe.parts.${partIndex}.steps`,
  });
  // Only one row is expanded at a time, so focusing or expanding another
  // row contracts the previous one.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [focusedIngredient, setFocusedIngredient] = useState<string | null>(
    null,
  );
  const knownIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    const ids = [...ingredients.fields, ...steps.fields].map(
      (field) => field.id,
    );
    if (knownIds.current === null) {
      knownIds.current = new Set(ids);
      return;
    }

    const newIds = ids.filter((id) => !knownIds.current?.has(id));
    if (newIds.length > 0) {
      setExpandedId(newIds[newIds.length - 1] ?? null);
    }
    knownIds.current = new Set(ids);
  }, [ingredients.fields, steps.fields]);

  const open = (id: string) => setExpandedId(id);
  const toggle = (id: string) =>
    setExpandedId((current) => (current === id ? null : id));

  return (
    <View
      className={cn(
        partIndex > 0 &&
          multiMode &&
          "mt-6 border-t border-[hsl(40,15%,86%)] pt-5",
      )}
    >
      {multiMode && (
        <View className="mb-4 gap-1.5">
          <FieldLabel>Part</FieldLabel>
          <View className="flex-row items-center gap-2">
            <Controller
              control={form.control}
              name={`recipe.parts.${partIndex}.name`}
              render={({ field }) => (
                <Input
                  value={field.value}
                  onBlur={field.onBlur}
                  onChangeText={field.onChange}
                  accessibilityLabel={`Part ${partIndex + 1} name`}
                  className="h-11 min-w-0 flex-1 bg-white font-serif text-base"
                  placeholder="Optional"
                />
              )}
            />
            <View className="flex-row">
              <IconButton
                label="Move part up"
                disabled={!canMoveUp}
                onPress={onMoveUp}
              >
                <ArrowUp size={17} color={colors.mutedForeground} />
              </IconButton>
              <IconButton
                label="Move part down"
                disabled={!canMoveDown}
                onPress={onMoveDown}
              >
                <ArrowDown size={17} color={colors.mutedForeground} />
              </IconButton>
              <IconButton label="Remove part" onPress={onRemove}>
                <X size={18} color={colors.destructive} />
              </IconButton>
            </View>
          </View>
        </View>
      )}

      <SectionLabel>Ingredients</SectionLabel>

      <View className="mt-1">
        {ingredients.fields.map((ingredient, ingredientIndex) => {
          const isExpanded = expandedId === ingredient.id;
          const name = form.watch(
            `recipe.parts.${partIndex}.ingredients.${ingredientIndex}.name`,
          );
          const ingredientError =
            form.formState.errors.recipe?.parts?.[partIndex]?.ingredients?.[
              ingredientIndex
            ];
          const suggestions =
            focusedIngredient === ingredient.id && name.trim().length > 0
              ? ingredientNames
                  .filter(
                    (candidate) =>
                      candidate.toLowerCase().includes(name.toLowerCase()) &&
                      candidate.toLowerCase() !== name.toLowerCase(),
                  )
                  .slice(0, 5)
              : [];

          return (
            <View
              key={ingredient.id}
              className={cn(
                "border-b border-[hsl(40,15%,92%)] px-1 py-1.5",
                isExpanded &&
                  "rounded-[10px] border border-[hsl(18,60%,80%)] bg-[hsl(40,33%,95%)]",
              )}
            >
              <View className="flex-row items-start gap-1.5">
                <Controller
                  control={form.control}
                  name={`recipe.parts.${partIndex}.ingredients.${ingredientIndex}.amount`}
                  render={({ field }) => (
                    <Input
                      value={field.value}
                      onBlur={field.onBlur}
                      onFocus={() => open(ingredient.id)}
                      onChangeText={field.onChange}
                      accessibilityLabel={`Ingredient ${ingredientIndex + 1} amount`}
                      keyboardType="decimal-pad"
                      textAlign="center"
                      className="h-11 w-[64px] bg-white px-1 py-0 font-bold"
                    />
                  )}
                />
                <Controller
                  control={form.control}
                  name={`recipe.parts.${partIndex}.ingredients.${ingredientIndex}.unit`}
                  render={({ field }) => (
                    <Pressable
                      accessibilityLabel={`Ingredient ${ingredientIndex + 1} unit`}
                      className="border-input h-11 w-[56px] items-center justify-center rounded-md border bg-white"
                      onPress={() => open(ingredient.id)}
                    >
                      <Text className="text-foreground text-sm">
                        {field.value ?? "–"}
                      </Text>
                    </Pressable>
                  )}
                />
                <View className="min-w-0 flex-1">
                  <Controller
                    control={form.control}
                    name={`recipe.parts.${partIndex}.ingredients.${ingredientIndex}.name`}
                    render={({ field }) => (
                      <Input
                        value={field.value}
                        onBlur={() => {
                          field.onBlur();
                          setTimeout(() => setFocusedIngredient(null), 150);
                        }}
                        onFocus={() => {
                          open(ingredient.id);
                          setFocusedIngredient(ingredient.id);
                        }}
                        onChangeText={field.onChange}
                        accessibilityLabel={`Ingredient ${ingredientIndex + 1} name`}
                        className="h-11 bg-white px-2.5"
                        placeholder="Ingredient"
                      />
                    )}
                  />
                  <FieldError message={ingredientError?.name?.message} />
                </View>
                <Pressable
                  accessibilityLabel={
                    isExpanded
                      ? "Hide ingredient controls"
                      : "Show ingredient controls"
                  }
                  className="h-11 w-[30px] items-center justify-center"
                  onPress={() => toggle(ingredient.id)}
                >
                  {isExpanded ? (
                    <ChevronDown size={19} color={colors.mutedForeground} />
                  ) : (
                    <ChevronRight size={19} color={colors.mutedForeground} />
                  )}
                </Pressable>
              </View>

              {isExpanded && (
                <View className="mt-2 gap-2">
                  {suggestions.length > 0 && (
                    <View className="border-border overflow-hidden rounded-md border bg-white">
                      {suggestions.map((suggestion, suggestionIndex) => (
                        <Pressable
                          key={suggestion}
                          className={cn(
                            "px-3 py-2.5",
                            suggestionIndex < suggestions.length - 1 &&
                              "border-b border-[hsl(40,15%,92%)]",
                          )}
                          onPress={() => {
                            form.setValue(
                              `recipe.parts.${partIndex}.ingredients.${ingredientIndex}.name`,
                              suggestion,
                              { shouldDirty: true },
                            );
                            setFocusedIngredient(null);
                          }}
                        >
                          <Text className="text-foreground text-sm">
                            {suggestion}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}

                  <Controller
                    control={form.control}
                    name={`recipe.parts.${partIndex}.ingredients.${ingredientIndex}.unit`}
                    render={({ field }) => (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={{ gap: 6 }}
                      >
                        {[null, ...UNITS].map((unit) => {
                          const selected = field.value === unit;
                          return (
                            <Pressable
                              key={unit ?? "none"}
                              accessibilityRole="radio"
                              accessibilityState={{ selected }}
                              className={cn(
                                "border-border min-w-10 rounded-full border bg-white px-3 py-2",
                                selected && "border-primary bg-primary/10",
                              )}
                              onPress={() => field.onChange(unit)}
                            >
                              <Text
                                className={cn(
                                  "text-muted-foreground text-center text-sm",
                                  selected && "text-primary font-semibold",
                                )}
                              >
                                {unit ?? "–"}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    )}
                  />

                  <Controller
                    control={form.control}
                    name={`recipe.parts.${partIndex}.ingredients.${ingredientIndex}.note`}
                    render={({ field }) => (
                      <Input
                        value={field.value}
                        onBlur={field.onBlur}
                        onChangeText={field.onChange}
                        accessibilityLabel={`Ingredient ${ingredientIndex + 1} note`}
                        className="h-10 bg-white text-sm"
                        placeholder="note — e.g. grated, cut in strips"
                      />
                    )}
                  />

                  <RowControls
                    canMoveUp={ingredientIndex > 0}
                    canMoveDown={
                      ingredientIndex < ingredients.fields.length - 1
                    }
                    onMoveUp={() =>
                      ingredients.move(ingredientIndex, ingredientIndex - 1)
                    }
                    onMoveDown={() =>
                      ingredients.move(ingredientIndex, ingredientIndex + 1)
                    }
                    onRemove={() => ingredients.remove(ingredientIndex)}
                  />
                </View>
              )}
              <FieldError
                message={
                  ingredientError?.amount?.message ??
                  ingredientError?.unit?.message
                }
              />
            </View>
          );
        })}

        <AddButton
          label="Add ingredient"
          onPress={() =>
            ingredients.append({
              amount: "",
              unit: null,
              name: "",
              note: "",
            })
          }
        />
      </View>

      <View className="mt-5">
        <SectionLabel>Steps</SectionLabel>
        <View className="mt-1">
          {steps.fields.map((step, stepIndex) => {
            const isExpanded = expandedId === step.id;
            const stepError =
              form.formState.errors.recipe?.parts?.[partIndex]?.steps?.[
                stepIndex
              ]?.text?.message;

            return (
              <View
                key={step.id}
                className={cn(
                  "border-b border-[hsl(40,15%,92%)] px-1 py-1.5",
                  isExpanded &&
                    "rounded-[10px] border border-[hsl(18,60%,80%)] bg-[hsl(40,33%,95%)]",
                )}
              >
                <View className="flex-row gap-2">
                  <Text className="w-[18px] pt-2 font-serif text-base text-[hsl(18,75%,50%)]">
                    {stepIndex + 1}
                  </Text>
                  <Controller
                    control={form.control}
                    name={`recipe.parts.${partIndex}.steps.${stepIndex}.text`}
                    render={({ field }) => (
                      <Textarea
                        value={field.value}
                        onBlur={field.onBlur}
                        onFocus={() => open(step.id)}
                        onChangeText={field.onChange}
                        accessibilityLabel={`Step ${stepIndex + 1}`}
                        className="min-h-10 min-w-0 flex-1 bg-white py-2 text-[15px]"
                        placeholder="Describe this step"
                        scrollEnabled={false}
                      />
                    )}
                  />
                  <Pressable
                    accessibilityLabel={
                      isExpanded ? "Hide step controls" : "Show step controls"
                    }
                    className="h-10 w-[30px] items-center justify-center"
                    onPress={() => toggle(step.id)}
                  >
                    {isExpanded ? (
                      <ChevronDown size={19} color={colors.mutedForeground} />
                    ) : (
                      <ChevronRight size={19} color={colors.mutedForeground} />
                    )}
                  </Pressable>
                </View>
                {isExpanded && (
                  <View className="ml-[26px] mt-2">
                    <RowControls
                      canMoveUp={stepIndex > 0}
                      canMoveDown={stepIndex < steps.fields.length - 1}
                      onMoveUp={() => steps.move(stepIndex, stepIndex - 1)}
                      onMoveDown={() => steps.move(stepIndex, stepIndex + 1)}
                      onRemove={() => steps.remove(stepIndex)}
                    />
                  </View>
                )}
                <View className="ml-[26px]">
                  <FieldError message={stepError} />
                </View>
              </View>
            );
          })}
          <AddButton
            label="Add step"
            onPress={() => steps.append({ text: "" })}
          />
        </View>
      </View>
    </View>
  );
}

function EditorTags({ form }: { form: UseFormReturn<RecipeEditorValues> }) {
  const [tagInput, setTagInput] = useState("");
  const tagsQuery = api.dinner.tags.useQuery(undefined, {
    select: (data) => data.tags.map((tag) => tag.value),
  });
  const selected = form.watch("tags");

  const addTag = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || selected.includes(trimmed)) return;
    form.setValue("tags", [...selected, trimmed], { shouldDirty: true });
    setTagInput("");
  };

  return (
    <View className="gap-2">
      <View className="flex-row flex-wrap gap-2">
        {selected.map((tag) => (
          <Pressable
            key={tag}
            accessibilityLabel={`Remove ${tag} tag`}
            className="bg-secondary flex-row items-center gap-1 rounded-full px-2.5 py-1.5"
            onPress={() =>
              form.setValue(
                "tags",
                selected.filter((candidate) => candidate !== tag),
                { shouldDirty: true },
              )
            }
          >
            <Text className="text-secondary-foreground text-xs font-semibold">
              {tag}
            </Text>
            <X size={12} color={colors.mutedForeground} />
          </Pressable>
        ))}
        <Input
          value={tagInput}
          onChangeText={setTagInput}
          onSubmitEditing={() => addTag(tagInput)}
          returnKeyType="done"
          className="h-9 min-w-[116px] flex-1 border-dashed bg-white"
          placeholder="Add tag…"
        />
      </View>

      {!!tagsQuery.data?.length && tagInput.length > 0 && (
        <View className="flex-row flex-wrap gap-2">
          {tagsQuery.data
            .filter(
              (tag) =>
                tag.toLowerCase().includes(tagInput.toLowerCase()) &&
                !selected.includes(tag),
            )
            .slice(0, 5)
            .map((tag) => (
              <Pressable
                key={tag}
                className="border-border rounded-full border bg-white px-2.5 py-1.5"
                onPress={() => addTag(tag)}
              >
                <Text className="text-muted-foreground text-xs">{tag}</Text>
              </Pressable>
            ))}
        </View>
      )}
    </View>
  );
}

function DeleteDinnerButton({
  dinnerId,
  isPending,
  onDelete,
}: {
  dinnerId: number;
  isPending: boolean;
  onDelete: () => void;
}) {
  const plansQuery = api.plan.plansForDinner.useQuery(
    { dinnerId },
    { enabled: false },
  );

  const confirmDelete = async () => {
    const result = await plansQuery.refetch();
    const dates =
      result.data?.plans.map((plan) => format(plan.date, "MMMM do, y")) ?? [];
    const affected =
      dates.length > 0
        ? `\n\nPlans on these dates will also be deleted:\n${dates.join("\n")}`
        : "";

    Alert.alert(
      "Delete dinner",
      `Are you sure? This cannot be undone.${affected}`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: onDelete },
      ],
    );
  };

  return (
    <Button
      variant="outline"
      disabled={isPending || plansQuery.isFetching}
      className="w-full border-[hsl(0,50%,85%)]"
      onPress={() => void confirmDelete()}
    >
      <Trash2 size={17} color="hsl(0, 60%, 48%)" />
      <Text className="text-sm font-semibold text-[hsl(0,60%,48%)]">
        Delete dinner
      </Text>
    </Button>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text className="text-muted-foreground text-xs font-semibold">
      {children}
    </Text>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text className="text-muted-foreground text-[11px] font-bold uppercase tracking-[1px]">
      {children}
    </Text>
  );
}

function AddButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="mt-2 w-full border-dashed border-[hsl(40,15%,80%)] bg-transparent"
      onPress={onPress}
    >
      <Plus size={16} color={colors.primary} />
      <Text className="text-primary text-sm font-medium">{label}</Text>
    </Button>
  );
}

function IconButton({
  label,
  children,
  disabled,
  onPress,
}: {
  label: string;
  children: React.ReactNode;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      disabled={disabled}
      className={cn(
        "h-10 w-9 items-center justify-center rounded-md",
        disabled && "opacity-30",
      )}
      onPress={onPress}
    >
      {children}
    </Pressable>
  );
}

function RowControls({
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-row">
        <IconButton label="Move up" disabled={!canMoveUp} onPress={onMoveUp}>
          <ArrowUp size={17} color={colors.mutedForeground} />
        </IconButton>
        <IconButton
          label="Move down"
          disabled={!canMoveDown}
          onPress={onMoveDown}
        >
          <ArrowDown size={17} color={colors.mutedForeground} />
        </IconButton>
      </View>
      <Pressable className="px-2 py-2" onPress={onRemove}>
        <Text className="text-destructive text-sm font-semibold">Remove</Text>
      </Pressable>
    </View>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <Text className="text-destructive mt-1 text-xs font-medium">{message}</Text>
  );
}
