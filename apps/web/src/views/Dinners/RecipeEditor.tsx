import { type CSSProperties, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Controller,
  type UseFormReturn,
  useFieldArray,
  useForm,
} from "react-hook-form";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Loader2,
  Minus,
  Plus,
  X,
} from "lucide-react";
import {
  UNITS,
  type DinnerWithRecipe,
  recipeIngredientSchema,
} from "@planeatrepeat/shared";
import { api } from "../../utils/api";
import { cn } from "../../lib/utils";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Form } from "../../components/ui/form";
import { FancyCombobox } from "../../components/ui/FancyCombobox";
import { DeleteDinnerButton } from "./DeleteDinnerButton";

const editorIngredientSchema = recipeIngredientSchema.extend({
  note: z.string(),
});

const recipeEditorSchema = z.object({
  name: z.string().trim().min(1, "Add a dinner name"),
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

type Props = {
  dinner: DinnerWithRecipe;
  isPending: boolean;
  onCancel: () => void;
  onSave: (values: RecipeEditorValues) => void;
  onDelete: () => void;
};

const emptyPart = (): RecipeEditorValues["recipe"]["parts"][number] => ({
  name: "",
  ingredients: [],
  steps: [],
});

export const RecipeEditor = ({
  dinner,
  isPending,
  onCancel,
  onSave,
  onDelete,
}: Props) => {
  const form = useForm<RecipeEditorValues>({
    resolver: zodResolver(recipeEditorSchema),
    defaultValues: {
      name: dinner.name,
      tags: dinner.tags.map((tag) => tag.value),
      newTag: "",
      link: dinner.link ?? "",
      notes: dinner.notes ?? "",
      recipe: {
        servings: dinner.servings,
        parts: dinner.parts.map((part) => ({
          name: part.name ?? "",
          ingredients: part.ingredients.map((ingredient) => ({
            name: ingredient.name,
            amount: ingredient.amount,
            unit: UNITS.find((unit) => unit === ingredient.unit) ?? null,
            note: ingredient.note ?? "",
          })),
          steps: part.steps.map((step) => ({ text: step.text })),
        })),
      },
    },
  });
  const parts = useFieldArray({
    control: form.control,
    name: "recipe.parts",
  });
  const watchedParts = form.watch("recipe.parts");
  const servings = form.watch("recipe.servings");
  const multiMode =
    watchedParts.length > 1 ||
    watchedParts.some((part) => part.name.trim().length > 0);
  const ingredientNamesQuery = api.dinner.ingredientNames.useQuery();

  const cancel = () => {
    if (
      !form.formState.isDirty ||
      window.confirm("Discard your unsaved changes?")
    ) {
      onCancel();
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSave)}
        className="mx-auto w-full max-w-[640px] pb-6"
      >
        <div className="bg-background/95 sticky top-0 z-20 -mx-4 mb-5 grid grid-cols-[1fr_auto_1fr] items-center border-b px-4 py-2 backdrop-blur">
          <Button
            type="button"
            variant="ghost"
            className="justify-self-start px-2"
            onClick={cancel}
          >
            Cancel
          </Button>
          <h1 className="font-serif text-base font-normal">Edit recipe</h1>
          <Button
            type="submit"
            size="sm"
            className="justify-self-end"
            disabled={isPending}
          >
            {isPending && <Loader2 className="animate-spin" />}
            Save
          </Button>
        </div>

        <div className="space-y-5">
          <div>
            <Input
              {...form.register("name")}
              aria-label="Dinner name"
              className="h-12 bg-white text-lg font-semibold"
              placeholder="Dinner name"
            />
            <FieldError message={form.formState.errors.name?.message} />
          </div>

          <div className="grid grid-cols-[116px_1fr] gap-2">
            <div
              className="grid h-10 grid-cols-[32px_1fr_32px] overflow-hidden rounded-md border bg-white"
              aria-label="Servings"
            >
              <button
                type="button"
                aria-label="Decrease servings"
                className="text-muted-foreground hover:bg-accent flex items-center justify-center border-r"
                onClick={() =>
                  form.setValue(
                    "recipe.servings",
                    Math.max(1, (servings ?? 2) - 1),
                    { shouldDirty: true },
                  )
                }
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <input
                {...form.register("recipe.servings", {
                  setValueAs: (value) => (value === "" ? null : Number(value)),
                })}
                className="min-w-0 bg-transparent text-center font-bold outline-none"
                type="number"
                min={1}
                inputMode="numeric"
                placeholder="–"
                aria-label="Number of servings"
              />
              <button
                type="button"
                aria-label="Increase servings"
                className="text-muted-foreground hover:bg-accent flex items-center justify-center border-l"
                onClick={() =>
                  form.setValue("recipe.servings", (servings ?? 0) + 1, {
                    shouldDirty: true,
                  })
                }
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <Input
              {...form.register("link")}
              type="url"
              className="bg-white"
              placeholder="Recipe link"
              aria-label="Recipe link"
            />
          </div>
          <FieldError
            message={
              form.formState.errors.link?.message ??
              form.formState.errors.recipe?.servings?.message
            }
          />

          <div className="space-y-2">
            <EditorTags form={form} />
          </div>

          <div className="border-t border-[hsl(40_15%_86%)] pt-5">
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
              type="button"
              variant="secondary"
              className="text-primary mt-4 w-full font-serif font-normal"
              onClick={() => parts.append(emptyPart())}
            >
              <Plus />
              {parts.fields.length === 0 ? "Add recipe" : "Add part"}
            </Button>
          </div>

          <div className="space-y-2 border-t border-[hsl(40_15%_86%)] pt-5">
            <label htmlFor="recipe-tips" className="font-serif text-base">
              Tips
            </label>
            <Textarea
              {...form.register("notes")}
              id="recipe-tips"
              className="min-h-24 bg-white text-[15px]"
              placeholder="Anything useful to remember next time"
            />
          </div>

          <DeleteDinnerButton
            dinnerId={dinner.id}
            isPending={isPending}
            onDelete={onDelete}
          />
        </div>
      </form>
    </Form>
  );
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

const PartEditor = ({
  form,
  partIndex,
  multiMode,
  ingredientNames,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onRemove,
}: PartEditorProps) => {
  const ingredients = useFieldArray({
    control: form.control,
    name: `recipe.parts.${partIndex}.ingredients`,
  });
  const steps = useFieldArray({
    control: form.control,
    name: `recipe.parts.${partIndex}.steps`,
  });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
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
      setExpanded((current) => new Set([...current, ...newIds]));
      knownIds.current = new Set(ids);
    }
  }, [ingredients.fields, steps.fields]);

  const open = (id: string) =>
    setExpanded((current) => new Set(current).add(id));
  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section
      className={cn(
        partIndex > 0 &&
          multiMode &&
          "mt-6 border-t border-[hsl(40_15%_86%)] pt-5",
      )}
    >
      {multiMode ? (
        <div className="mb-3 grid grid-cols-[1fr_auto] items-center gap-2">
          <Input
            {...form.register(`recipe.parts.${partIndex}.name`)}
            className="h-10 bg-white font-serif text-base"
            placeholder="Part name (optional)"
            aria-label={`Part ${partIndex + 1} name`}
          />
          <div className="flex">
            <IconButton
              label="Move part up"
              disabled={!canMoveUp}
              onClick={onMoveUp}
            >
              <ArrowUp />
            </IconButton>
            <IconButton
              label="Move part down"
              disabled={!canMoveDown}
              onClick={onMoveDown}
            >
              <ArrowDown />
            </IconButton>
            <IconButton label="Remove part" destructive onClick={onRemove}>
              <X />
            </IconButton>
          </div>
        </div>
      ) : (
        <SectionLabel>Ingredients</SectionLabel>
      )}

      <div className="mt-2">
        {ingredients.fields.map((ingredient, ingredientIndex) => {
          const isExpanded = expanded.has(ingredient.id);
          const note = form.watch(
            `recipe.parts.${partIndex}.ingredients.${ingredientIndex}.note`,
          );
          const ingredientError =
            form.formState.errors.recipe?.parts?.[partIndex]?.ingredients?.[
              ingredientIndex
            ];

          return (
            <div
              key={ingredient.id}
              className={cn(
                "border-b border-[hsl(40_15%_92%)] px-1 py-2",
                isExpanded &&
                  "rounded-[10px] border-transparent bg-[hsl(40_33%_95%)] shadow-[inset_0_0_0_1px_hsl(18_60%_80%)]",
              )}
            >
              <div className="grid grid-cols-[52px_58px_1fr_30px] gap-1.5">
                <input
                  {...form.register(
                    `recipe.parts.${partIndex}.ingredients.${ingredientIndex}.amount`,
                    {
                      setValueAs: (value) =>
                        value === "" ? null : Number(value),
                    },
                  )}
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  placeholder="0"
                  aria-label={`Ingredient ${ingredientIndex + 1} amount`}
                  className="focus:border-primary focus:ring-primary/15 h-9 min-w-0 rounded-md border bg-white px-1 text-center font-bold outline-none focus:ring-[3px]"
                />
                <Controller
                  control={form.control}
                  name={`recipe.parts.${partIndex}.ingredients.${ingredientIndex}.unit`}
                  render={({ field }) => (
                    <select
                      ref={field.ref}
                      value={field.value ?? ""}
                      onBlur={field.onBlur}
                      onChange={(event) =>
                        field.onChange(event.target.value || null)
                      }
                      aria-label={`Ingredient ${ingredientIndex + 1} unit`}
                      className="focus:border-primary focus:ring-primary/15 h-9 min-w-0 rounded-md border bg-white px-1 text-center text-sm outline-none focus:ring-[3px]"
                    >
                      <option value="">–</option>
                      {UNITS.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  )}
                />
                <Input
                  {...form.register(
                    `recipe.parts.${partIndex}.ingredients.${ingredientIndex}.name`,
                  )}
                  list="recipe-ingredient-names"
                  className="h-9 min-w-0 bg-white px-2"
                  placeholder="Ingredient"
                  aria-label={`Ingredient ${ingredientIndex + 1} name`}
                />
                <button
                  type="button"
                  aria-label={
                    isExpanded
                      ? "Hide ingredient controls"
                      : "Show ingredient controls"
                  }
                  className={cn(
                    "text-muted-foreground flex items-center justify-center rounded-md",
                    note && "text-primary",
                  )}
                  onClick={() => toggle(ingredient.id)}
                >
                  {isExpanded ? <ChevronDown /> : <ChevronRight />}
                </button>
              </div>

              {isExpanded && (
                <div className="mt-2 space-y-2">
                  <Input
                    {...form.register(
                      `recipe.parts.${partIndex}.ingredients.${ingredientIndex}.note`,
                    )}
                    className="h-9 bg-white text-sm"
                    placeholder="note — e.g. grated, cut in strips"
                    aria-label={`Ingredient ${ingredientIndex + 1} note`}
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
                </div>
              )}
              <FieldError
                message={
                  ingredientError?.name?.message ??
                  ingredientError?.amount?.message ??
                  ingredientError?.unit?.message
                }
              />
            </div>
          );
        })}

        <datalist id="recipe-ingredient-names">
          {ingredientNames.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>

        <AddButton
          label="Add ingredient"
          onClick={() =>
            ingredients.append({
              amount: null,
              unit: null,
              name: "",
              note: "",
            })
          }
        />
      </div>

      <div className="mt-5">
        <SectionLabel>Steps</SectionLabel>
        <div className="mt-2">
          {steps.fields.map((step, stepIndex) => {
            const isExpanded = expanded.has(step.id);
            const stepError =
              form.formState.errors.recipe?.parts?.[partIndex]?.steps?.[
                stepIndex
              ]?.text?.message;

            return (
              <div
                key={step.id}
                className={cn(
                  "border-b border-[hsl(40_15%_92%)] px-1 py-2",
                  isExpanded &&
                    "rounded-[10px] border-transparent bg-[hsl(40_33%_95%)] shadow-[inset_0_0_0_1px_hsl(18_60%_80%)]",
                )}
              >
                <div className="grid grid-cols-[18px_1fr] gap-2">
                  <span className="pt-2 font-serif text-[hsl(18_75%_50%)]">
                    {stepIndex + 1}
                  </span>
                  <Textarea
                    {...form.register(
                      `recipe.parts.${partIndex}.steps.${stepIndex}.text`,
                    )}
                    className="min-h-10 resize-none overflow-hidden bg-white py-2 text-[15px]"
                    placeholder="Describe this step"
                    aria-label={`Step ${stepIndex + 1}`}
                    onFocus={() => open(step.id)}
                    onInput={(event) => {
                      event.currentTarget.style.height = "auto";
                      event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`;
                    }}
                    style={{ fieldSizing: "content" } as CSSProperties}
                  />
                </div>
                {isExpanded && (
                  <div className="ml-[26px] mt-2">
                    <RowControls
                      canMoveUp={stepIndex > 0}
                      canMoveDown={stepIndex < steps.fields.length - 1}
                      onMoveUp={() => steps.move(stepIndex, stepIndex - 1)}
                      onMoveDown={() => steps.move(stepIndex, stepIndex + 1)}
                      onRemove={() => steps.remove(stepIndex)}
                    />
                  </div>
                )}
                <div className="ml-[26px]">
                  <FieldError message={stepError} />
                </div>
              </div>
            );
          })}
          <AddButton
            label="Add step"
            onClick={() => steps.append({ text: "" })}
          />
        </div>
      </div>
    </section>
  );
};

const EditorTags = ({ form }: { form: UseFormReturn<RecipeEditorValues> }) => {
  const tagsQuery = api.dinner.tags.useQuery(undefined, {
    select: (data) =>
      data.tags.map((tag) => ({ value: tag.value, label: tag.value })),
  });
  const selected = form.watch("tags").map((tag) => ({
    value: tag,
    label: tag,
  }));

  return (
    <FancyCombobox
      options={tagsQuery.data ?? []}
      placeholder="Add tag…"
      selected={selected}
      select={(option) =>
        form.setValue("tags", [...form.getValues("tags"), option.value], {
          shouldDirty: true,
        })
      }
      unselect={(option) =>
        form.setValue(
          "tags",
          form.getValues("tags").filter((tag) => tag !== option.value),
          { shouldDirty: true },
        )
      }
      removeLast={() =>
        form.setValue("tags", form.getValues("tags").slice(0, -1), {
          shouldDirty: true,
        })
      }
      createNew={(value) =>
        form.setValue("tags", [...form.getValues("tags"), value], {
          shouldDirty: true,
        })
      }
    />
  );
};

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-muted-foreground text-[11px] font-bold uppercase tracking-[0.1em]">
    {children}
  </h2>
);

const AddButton = ({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) => (
  <Button
    type="button"
    variant="outline"
    className="text-primary mt-2 h-9 w-full border-dashed border-[hsl(40_15%_80%)] bg-transparent"
    onClick={onClick}
  >
    <Plus />
    {label}
  </Button>
);

const IconButton = ({
  label,
  children,
  disabled,
  destructive,
  onClick,
}: {
  label: string;
  children: React.ReactNode;
  disabled?: boolean;
  destructive?: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    disabled={disabled}
    className={cn(
      "text-muted-foreground hover:bg-accent flex h-9 w-8 items-center justify-center rounded-md disabled:opacity-30",
      destructive && "text-destructive",
    )}
    onClick={onClick}
  >
    {children}
  </button>
);

const RowControls = ({
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
}) => (
  <div className="flex items-center justify-between">
    <div className="flex">
      <IconButton label="Move up" disabled={!canMoveUp} onClick={onMoveUp}>
        <ArrowUp />
      </IconButton>
      <IconButton
        label="Move down"
        disabled={!canMoveDown}
        onClick={onMoveDown}
      >
        <ArrowDown />
      </IconButton>
    </div>
    <button
      type="button"
      className="text-destructive px-2 py-1 text-sm font-semibold"
      onClick={onRemove}
    >
      Remove
    </button>
  </div>
);

const FieldError = ({ message }: { message?: string }) =>
  message ? (
    <p className="text-destructive mt-1 text-xs font-medium">{message}</p>
  ) : null;
