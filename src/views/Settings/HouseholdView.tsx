import { type Household } from "@prisma/client";

import { useForm, type UseFormReturn } from "react-hook-form";
import { api } from "../../utils/api";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../../components/ui/form";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { toast } from "../../components/ui/use-toast";
import { BottomNav } from "../BottomNav";

type Props = { currentHousehold?: Household };

export const HouseholdView = ({ currentHousehold }: Props) => {
  return (
    <div>
      <div className="flex flex-col p-4">
        {currentHousehold ? (
          <EditHousehold household={currentHousehold} />
        ) : (
          <NewHousehold />
        )}
      </div>
      <BottomNav />
    </div>
  );
};

const householdFormSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  slug: z.string().min(3, "Slug must be at least 3 characters"),
});

type HouseholdFormData = z.infer<typeof householdFormSchema>;

const NewHousehold = () => {
  const utils = api.useUtils();
  const form = useForm<HouseholdFormData>({
    resolver: zodResolver(householdFormSchema),
    defaultValues: {
      name: "",
      slug: "",
    },
  });

  const createHouseholdMutation = api.household.createHousehold.useMutation({
    onSuccess: () => {
      void utils.household.invalidate();
      toast({
        title: "Household created",
        description: "Your household has been created successfully",
      });
    },
  });

  const onSubmit = (data: HouseholdFormData) => {
    createHouseholdMutation.mutate(data);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold">Create Household</h1>
      <HouseholdForm
        form={form}
        onSubmit={onSubmit}
        submitLabel="Create Household"
      />
    </div>
  );
};

type EditHouseholdProps = {
  household: Household;
};

const EditHousehold = ({ household }: EditHouseholdProps) => {
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
      id: household.id,
      name: data.name,
      slug: data.slug,
    });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold">Edit {household.name}</h1>
      <HouseholdForm
        form={form}
        onSubmit={onSubmit}
        submitLabel="Update Household"
      />
    </div>
  );
};

type HouseholdFormProps = {
  form: UseFormReturn<HouseholdFormData>;
  onSubmit: (data: HouseholdFormData) => void;
  submitLabel: string;
};

const HouseholdForm = ({ form, onSubmit, submitLabel }: HouseholdFormProps) => {
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
                <Input {...field} />
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
            </FormItem>
          )}
        />

        <div className="flex justify-between">
          <Button type="submit">{submitLabel}</Button>
        </div>
      </form>
    </Form>
  );
};
