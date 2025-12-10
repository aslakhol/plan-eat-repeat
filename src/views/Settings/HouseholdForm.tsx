import { toast } from "../../components/ui/use-toast";

import { type Household } from "@prisma/client";
import { api } from "../../utils/api";
import { z } from "zod";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "../../components/ui/input";
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
});

type HouseholdFormData = z.infer<typeof householdFormSchema>;

export const NewHousehold = () => {
  const router = useRouter();
  const { user } = useClerk();

  const utils = api.useUtils();
  const form = useForm<HouseholdFormData>({
    resolver: zodResolver(householdFormSchema),
    defaultValues: {
      name: "",
      slug: "",
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
};

export const EditHousehold = ({ household }: EditHouseholdProps) => {
  const utils = api.useUtils();
  const form = useForm<HouseholdFormData>({
    resolver: zodResolver(householdFormSchema),
    defaultValues: {
      name: household.name,
      slug: household.slug,
    },
  });

  const updateHouseholdMutation = api.household.updateHousehold.useMutation({
    onSuccess: () => {
      void utils.household.invalidate();
      toast({
        title: "Household updated",
        description: "Your household has been updated successfully",
      });
    },
  });

  const onSubmit = (data: HouseholdFormData) => {
    updateHouseholdMutation.mutate({
      name: data.name,
      slug: data.slug,
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
};

const HouseholdForm = ({
  form,
  onSubmit,
  submitLabel,
  isSubmitting,
}: HouseholdFormProps) => {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
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
                The slug is used to identify your household. It will be part of
                the URL for your household invitations.
              </FormDescription>
            </FormItem>
          )}
        />

        <div className="flex justify-between">
          <Button type="submit" disabled={isSubmitting} variant="outline">
            {submitLabel}
          </Button>
        </div>
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
