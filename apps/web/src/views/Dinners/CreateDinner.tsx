import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { usePostHog } from "posthog-js/react";
import { Loader2 } from "lucide-react";

import { toast } from "~/components/ui/use-toast";
import { api } from "~/utils/api";
import {
  RecipeEditor,
  dinnerFromEditorValues,
  editorValuesFromManualName,
  type RecipeEditorValues,
} from "~/views/Dinners/RecipeEditor";
import {
  editorCancelHref,
  editorSaveNavigation,
  parseEditorNavigation,
  planSlotDateFromString,
} from "~/lib/editor-navigation";
import { useDinnerCreation } from "~/views/Dinners/DinnerCreationContext";

export const CreateDinner = () => {
  const router = useRouter();
  const posthog = usePostHog();
  const utils = api.useUtils();
  const { importedDraft, setImportedDraft } = useDinnerCreation();
  const navigation = parseEditorNavigation(router.query);
  const [draft] = useState(importedDraft);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (importedDraft) setImportedDraft(null);
  }, [importedDraft, setImportedDraft]);

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

  const initialValues =
    draft?.values ?? editorValuesFromManualName(navigation.name ?? "");

  return (
    <RecipeEditor
      key={
        draft ? `${draft.values.name}-${draft.values.link}` : navigation.name
      }
      initialValues={initialValues}
      importedNameAlternative={draft?.importedNameAlternative}
      isPending={createMutation.isPending}
      submitError={submitError}
      onCancel={() => void router.replace(editorCancelHref(navigation))}
      onSave={createDinner}
    />
  );
};
