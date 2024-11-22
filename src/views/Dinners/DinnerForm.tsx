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
import {
  Dialog,
  DialogFooter,
  DialogDescription,
  DialogTitle,
  DialogHeader,
  DialogTrigger,
  DialogContent,
} from "../../components/ui/dialog";
import { useState } from "react";
import { format } from "date-fns";

type Props = {
  onSubmit(values: z.infer<typeof dinnerFormSchema>): void;
  onDelete?(values: z.infer<typeof dinnerFormSchema>): void;
  existingDinner?: DinnerWithTags;
  closeDialog: () => void;
  isLoading: boolean;
};

export const DinnerForm = ({
  onSubmit,
  onDelete,
  existingDinner,
  closeDialog,
  isLoading,
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
          <Button type="submit" disabled={isLoading}>
            Save
          </Button>
          <div className="flex gap-2">
            {onDelete && existingDinner && (
              <Delete
                onDelete={onDelete}
                isLoading={isLoading}
                form={form}
                dinner={existingDinner}
              />
            )}
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
  isLoading: boolean;
  form: UseFormReturn<z.infer<typeof dinnerFormSchema>>;
  dinner: DinnerWithTags;
};

const Delete = ({ onDelete, isLoading, form, dinner }: DeleteProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const plansQuery = api.plan.plansForDinner.useQuery({
    dinnerId: dinner.id,
  });

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant={"destructive"}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete dinner</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this dinner? This action cannot be
            undone.
          </DialogDescription>
        </DialogHeader>
        {plansQuery.isSuccess && (
          <div className="space-y-2">
            <p>
              If you delete this dinner, the plan for the following dates will
              also be deleted:
            </p>
            <div className="max-h-[200px] overflow-y-auto rounded border p-2">
              <ul className="space-y-1">
                {plansQuery.data.plans.map((plan) => (
                  <li key={plan.id}>{format(plan.date, "LLLL do, y")}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={isLoading || plansQuery.isLoading}
            onClick={async () => {
              await form.handleSubmit(onDelete)();
              setDialogOpen(false);
            }}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
