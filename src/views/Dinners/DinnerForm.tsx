import { zodResolver } from "@hookform/resolvers/zod";
import { type z } from "zod";
import { dinnerFormSchema, type DinnerWithTags } from "../../utils/types";
import { useForm } from "react-hook-form";
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

  const tags = form.watch("tags");
  const newTag = form.watch("newTag")?.trim();

  const addTag = () => {
    if (!newTag || tags.includes(newTag)) {
      return;
    }
    form.setValue("tags", [...tags, newTag]);
    form.setValue("newTag", "");
  };

  const removeTag = (tag: string) => {
    form.setValue(
      "tags",
      tags.filter((t) => t !== tag),
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
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
        <div>
          <Label>Tags</Label>
          <div className="flex flex-wrap gap-2">
            {form.getValues("tags").map((tag) => (
              <div
                className="rounded bg-green-100 px-2 py-1 text-green-800 active:bg-green-200"
                key={tag}
                onClick={() => removeTag(tag)}
              >
                {tag}
              </div>
            ))}
          </div>
        </div>

        <FormField
          control={form.control}
          name="newTag"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Add tag</FormLabel>
              <FormControl>
                <div className="flex w-full max-w-sm items-center space-x-2">
                  <Input
                    {...field}
                    onKeyDown={(e) => {
                      if (e.code !== "Enter") {
                        return;
                      }
                      e.preventDefault();
                      addTag();
                    }}
                  />
                  <Button type="button" variant="outline" onClick={addTag}>
                    +
                  </Button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
          <Button
            type="button"
            variant={"outline"}
            onClick={onDelete ? form.handleSubmit(onDelete) : closeDialog}
          >
            {onDelete ? "Delete" : "Cancel"}
          </Button>
        </div>
      </form>
    </Form>
  );
};