import { toast } from "../../components/ui/use-toast";

import { IMPORT_PROMPT_MAX_LENGTH } from "@planeatrepeat/shared";
import { useUnsavedSettingsPrompt } from "./use-unsaved-settings-prompt";

import type { Household } from "@planeatrepeat/db";
import { api } from "../../utils/api";
import { z } from "zod";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import {
  FormControl,
  FormField,
  FormLabel,
  FormItem,
  FormMessage,
  Form,
  FormDescription,
} from "../../components/ui/form";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "../../components/ui/card";
import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/router";

const householdFormSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  slug: z.string().min(3, "Slug must be at least 3 characters"),
  importInstructions: z.string().max(IMPORT_PROMPT_MAX_LENGTH),
});

type HouseholdFormData = z.infer<typeof householdFormSchema>;

export const NewHousehold = ({
  systemDefaultPrompt,
}: {
  systemDefaultPrompt: string;
}) => {
  const router = useRouter();
  const { user } = useClerk();

  const utils = api.useUtils();
  const form = useForm<HouseholdFormData>({
    resolver: zodResolver(householdFormSchema),
    defaultValues: {
      name: "",
      slug: "",
      importInstructions: systemDefaultPrompt,
    },
  });

  const createHouseholdMutation = api.household.createHousehold.useMutation({
    onSuccess: async () => {
      void utils.household.invalidate();
      await user?.reload();
      router.reload();
      toast({
        title: "Created household",
        description:
          "Your household has been created successfully, to invite people you can head to settings -> household. Next step now is to make a couple of dinners!",
      });
    },
  });

  const onSubmit = async (data: HouseholdFormData) => {
    await createHouseholdMutation.mutateAsync(data);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Household</CardTitle>
        <CardDescription>
          To use PlanEatRepeat you need to create a household. If you&apos;d
          like, you can invite other people to join later.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <HouseholdForm
          systemDefaultPrompt={systemDefaultPrompt}
          householdPrompt={systemDefaultPrompt}
          form={form}
          onSubmit={onSubmit}
          submitLabel="Create Household"
          isSubmitting={createHouseholdMutation.isPending}
        />
      </CardContent>
    </Card>
  );
};

type EditHouseholdProps = {
  household: Household;
  systemDefaultPrompt: string;
};

export const EditHousehold = ({
  household,
  systemDefaultPrompt,
}: EditHouseholdProps) => {
  const utils = api.useUtils();
  const form = useForm<HouseholdFormData>({
    resolver: zodResolver(householdFormSchema),
    defaultValues: {
      name: household.name,
      slug: household.slug,
      importInstructions: household.importInstructions ?? systemDefaultPrompt,
    },
  });

  const prompt = form.watch("importInstructions");
  useUnsavedSettingsPrompt(
    prompt !== form.formState.defaultValues?.importInstructions,
  );

  const updateHouseholdMutation = api.household.updateHousehold.useMutation({
    onSuccess: ({ household: saved }) => {
      form.reset({
        name: saved.name,
        slug: saved.slug,
        importInstructions: saved.importInstructions ?? systemDefaultPrompt,
      });
      void utils.household.invalidate();
      toast({
        title: "Household updated",
        description: "Your household has been updated successfully",
      });
    },
    onError: (error) =>
      toast({
        title: "Couldn't save household",
        description: error.message,
        variant: "destructive",
      }),
  });

  const onSubmit = (data: HouseholdFormData) => {
    updateHouseholdMutation.mutate({
      name: data.name,
      slug: data.slug,
      importInstructions: data.importInstructions,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Household</CardTitle>
      </CardHeader>
      <CardContent>
        <HouseholdForm
          form={form}
          onSubmit={onSubmit}
          systemDefaultPrompt={systemDefaultPrompt}
          householdPrompt={household.importInstructions ?? systemDefaultPrompt}
          submitLabel="Save changes"
          isSubmitting={updateHouseholdMutation.isPending}
        />
      </CardContent>
    </Card>
  );
};

type HouseholdFormProps = {
  form: UseFormReturn<HouseholdFormData>;
  onSubmit: (data: HouseholdFormData) => void;
  submitLabel: string;
  isSubmitting: boolean;
  systemDefaultPrompt: string;
  householdPrompt: string;
};

const HouseholdForm = ({
  form,
  onSubmit,
  submitLabel,
  isSubmitting,
  systemDefaultPrompt,
  householdPrompt,
}: HouseholdFormProps) => {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <fieldset disabled={isSubmitting} className="space-y-8">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Household Name</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      form.setValue("slug", slugify(e.target.value));
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="slug"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Household Slug</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
                <FormDescription>
                  The slug is used to identify your household. It will be part
                  of the URL for your household invitations.
                </FormDescription>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="importInstructions"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Household Prompt</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    maxLength={IMPORT_PROMPT_MAX_LENGTH}
                    className="h-80 max-h-[50vh] resize-none overflow-y-auto"
                  />
                </FormControl>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      form.setValue("importInstructions", householdPrompt, {
                        shouldDirty: true,
                      })
                    }
                  >
                    Reset to household
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      form.setValue("importInstructions", systemDefaultPrompt, {
                        shouldDirty: true,
                      })
                    }
                  >
                    Reset to app default
                  </Button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-between">
            <Button type="submit" disabled={isSubmitting} variant="outline">
              {submitLabel}
            </Button>
          </div>
        </fieldset>
      </form>
    </Form>
  );
};

const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w\-]+/g, "") // Remove all non-word chars
    .replace(/\-\-+/g, "-") // Replace multiple - with single -
    .replace(/^-+/, "") // Trim - from start of text
    .replace(/-+$/, ""); // Trim - from end of text
};
