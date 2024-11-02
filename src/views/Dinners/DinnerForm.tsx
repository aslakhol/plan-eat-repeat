import { zodResolver } from "@hookform/resolvers/zod";
import { type z } from "zod";
import { dinnerFormSchema, type DinnerWithTags } from "../../utils/types";
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
import { Trash2 } from "lucide-react";

type Props = {
  onSubmit(values: z.infer<typeof dinnerFormSchema>): void;
  onDelete?(values: z.infer<typeof dinnerFormSchema>): void;
  existingDinner?: DinnerWithTags;
  closeDialog: () => void;
};

export const DinnerForm = ({
  onSubmit,
  onDelete,
  existingDinner,
  closeDialog,
}: Props) => {
  const form = useForm<z.infer<typeof dinnerFormSchema>>({
    resolver: zodResolver(dinnerFormSchema),
    defaultValues: {
      name: existingDinner?.name ?? "",
      tags: existingDinner?.tags.map((tag) => tag.value) ?? [],
      newTag: "",
      link: existingDinner?.link ?? "",
      notes: existingDinner?.notes ?? "",
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
        <div className="flex justify-between">
          <Button type="submit">Save</Button>
          <div className="flex gap-2">
            {onDelete && <Delete onDelete={onDelete} form={form} />}
            <Button type="button" variant={"outline"} onClick={closeDialog}>
              {"Cancel"}
            </Button>
          </div>
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

type DeleteProps = {
  onDelete(values: z.infer<typeof dinnerFormSchema>): void;
  form: UseFormReturn<z.infer<typeof dinnerFormSchema>>;
};

const Delete = ({ onDelete, form }: DeleteProps) => {
  return (
    <Button
      type="button"
      variant={"destructive"}
      onClick={form.handleSubmit(onDelete)}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
};
