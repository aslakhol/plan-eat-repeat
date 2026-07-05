import { zodResolver } from "@hookform/resolvers/zod";
import { type z } from "zod";
import { dinnerFormSchema } from "../../utils/types";
import { useForm, type UseFormReturn } from "react-hook-form";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../../components/ui/form";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Label } from "../../components/ui/label";
import { FancyCombobox } from "../../components/ui/FancyCombobox";
import { api } from "../../utils/api";

type Props = {
  onSubmit: (values: z.infer<typeof dinnerFormSchema>) => void;
  closeDialog: () => void;
  isPending: boolean;
};

export const DinnerForm = ({ onSubmit, closeDialog, isPending }: Props) => {
  const form = useForm<z.infer<typeof dinnerFormSchema>>({
    resolver: zodResolver(dinnerFormSchema),
    defaultValues: {
      name: "",
      tags: [],
      newTag: "",
      link: "",
      notes: "",
    },
  });

  const submit = (values: z.infer<typeof dinnerFormSchema>) => {
    onSubmit(values);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-8">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="space-y-2">
          <Label>Tags</Label>
          <TagsCombobox form={form} />
        </div>

        <FormField
          control={form.control}
          name="link"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Link</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={closeDialog}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            Save
          </Button>
        </div>
      </form>
    </Form>
  );
};

type TagsComboboxProps = {
  form: UseFormReturn<z.infer<typeof dinnerFormSchema>>;
};

const TagsCombobox = ({ form }: TagsComboboxProps) => {
  const { data: existingTags } = api.dinner.tags.useQuery(undefined, {
    select: (data) =>
      data.tags.map((tag) => ({ value: tag.value, label: tag.value })),
  });
  const selectedTags = form.watch("tags").map((tag) => ({
    value: tag,
    label: tag,
  }));

  const select = (option: { value: string; label: string }) => {
    form.setValue("tags", [...form.getValues("tags"), option.value]);
  };

  const unselect = (option: { value: string; label: string }) => {
    const currentTags = form.getValues("tags");
    form.setValue(
      "tags",
      currentTags.filter((tag) => tag !== option.value),
    );
  };

  const removeLast = () => {
    const currentTags = form.getValues("tags");
    form.setValue("tags", currentTags.slice(0, -1));
  };

  const createNew = (value: string) => {
    const trimmedValue = value.trim();
    if (!trimmedValue) return;
    form.setValue("tags", [...form.getValues("tags"), trimmedValue]);
  };

  return (
    <FancyCombobox
      options={existingTags ?? []}
      placeholder="Add tag"
      selected={selectedTags}
      select={select}
      unselect={unselect}
      removeLast={removeLast}
      createNew={createNew}
    />
  );
};
