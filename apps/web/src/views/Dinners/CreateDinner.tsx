import { useRouter } from "next/router";
import { usePostHog } from "posthog-js/react";
import { toast } from "../../components/ui/use-toast";
import { api } from "../../utils/api";
import {
  RecipeEditor,
  dinnerFromEditorValues,
  type RecipeEditorValues,
} from "./RecipeEditor";

export const CreateDinner = () => {
  const router = useRouter();
  const posthog = usePostHog();
  const utils = api.useUtils();

  const createMutation = api.dinner.create.useMutation({
    onSuccess: async (result) => {
      toast({ title: `${result.dinner.name} created` });
      await Promise.all([
        utils.dinner.dinners.invalidate(),
        utils.dinner.tags.invalidate(),
        utils.dinner.ingredientNames.invalidate(),
      ]);
      void router.push(`/dinners/${result.dinner.id}`);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Could not create dinner",
        description: error.message,
      });
    },
  });

  const createDinner = (values: RecipeEditorValues) => {
    posthog.capture("create new dinner", { dinnerName: values.name });
    createMutation.mutate(dinnerFromEditorValues(values));
  };

  return (
    <RecipeEditor
      isPending={createMutation.isPending}
      onCancel={() => void router.push("/dinners")}
      onSave={createDinner}
    />
  );
};
