import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { ArrowLeft, UtensilsCrossed } from "lucide-react";
import { recipeSchema } from "@planeatrepeat/shared";
import { usePostHog } from "posthog-js/react";
import { api } from "../../utils/api";
import { toast } from "../../components/ui/use-toast";
import { Button } from "../../components/ui/button";
import { RecipeEditor, type RecipeEditorValues } from "./RecipeEditor";
import { RecipeView } from "./RecipeView";

const textOrNull = (value: string | undefined) => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed;
};

export const DinnerDetail = () => {
  const router = useRouter();
  const posthog = usePostHog();
  const utils = api.useUtils();
  const [editing, setEditing] = useState(false);
  const rawDinnerId = router.query.dinnerId;
  const dinnerId =
    typeof rawDinnerId === "string" ? Number(rawDinnerId) : Number.NaN;
  const validDinnerId = Number.isInteger(dinnerId);

  const dinnerQuery = api.dinner.get.useQuery(
    { dinnerId },
    { enabled: router.isReady && validDinnerId },
  );

  const editMutation = api.dinner.edit.useMutation({
    onSuccess: async (result) => {
      toast({ title: `${result.dinner.name} updated` });
      await Promise.all([
        utils.dinner.get.invalidate({ dinnerId }),
        utils.dinner.dinners.invalidate(),
        utils.dinner.ingredientNames.invalidate(),
      ]);
      setEditing(false);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Could not save dinner",
        description: error.message,
      });
    },
  });

  const deleteMutation = api.dinner.delete.useMutation({
    onSuccess: async (result) => {
      toast({ title: `${result.dinner.name} deleted` });
      await utils.dinner.dinners.invalidate();
      void router.push("/dinners");
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Could not delete dinner",
        description: error.message,
      });
    },
  });

  if (!router.isReady || dinnerQuery.isPending) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <UtensilsCrossed className="text-primary animate-spin" />
      </div>
    );
  }

  if (!validDinnerId || dinnerQuery.isError || !dinnerQuery.data?.dinner) {
    return (
      <div className="mx-auto max-w-[640px] space-y-4 py-12 text-center">
        <h1 className="font-serif text-2xl">Dinner not found</h1>
        <Button asChild variant="outline">
          <Link href="/dinners">
            <ArrowLeft />
            Back to dinners
          </Link>
        </Button>
      </div>
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

    posthog.capture("update dinner", { dinnerName: values.name });
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
        dinner={dinner}
        isPending={editMutation.isPending || deleteMutation.isPending}
        onCancel={() => setEditing(false)}
        onSave={save}
        onDelete={() => {
          posthog.capture("delete dinner", { dinnerName: dinner.name });
          deleteMutation.mutate({ dinnerId: dinner.id });
        }}
      />
    );
  }

  return <RecipeView dinner={dinner} onEdit={() => setEditing(true)} />;
};
