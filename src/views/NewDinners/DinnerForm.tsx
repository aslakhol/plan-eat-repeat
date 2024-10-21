import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { type DinnerWithTags } from "../../utils/types";
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
import { asOptionalStringWithoutEmpty } from "../../utils/zod";
import { Label } from "../../components/ui/label";
import { api } from "../../utils/api";
import { toast } from "../../components/ui/use-toast";
import { usePostHog } from "posthog-js/react";

type Props = {
  existingDinner?: DinnerWithTags;
  closeDialog: () => void;
};

export const DinnerForm = ({ existingDinner, closeDialog }: Props) => {
  const updateDinnerMutation = api.dinner.edit.useMutation({
    onSuccess: (result) => {
      toast({
        title: `${result.dinner.name} updated`,
      });
      closeDialog();
    },
  });

  const deleteDinnerMutation = api.dinner.delete.useMutation({
    onSuccess: (result) => {
      toast({
        title: `${result.dinner.name} deleted`,
      });
      closeDialog();
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Something went wrong",
        description: error.message,
      });
    },
  });

  const form = useForm<z.infer<typeof dinnerFormSchema>>({
    resolver: zodResolver(dinnerFormSchema),
    defaultValues: {
      name: existingDinner?.name,
      tags: existingDinner?.tags.map((tag) => tag.value),
      newTag: "",
      link: "",
      notes: "",
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

  const utils = api.useUtils();
  const posthog = usePostHog();

  function updateDinner(values: z.infer<typeof dinnerFormSchema>) {
    posthog.capture("update dinner", { dinnerName: values.name });

    if (!existingDinner) {
      return;
    }

    updateDinnerMutation.mutate(
      {
        dinnerName: values.name,
        dinnerId: existingDinner.id,
        secret: localStorage.getItem("sulten-secret"),
        tagList: values.tags,
      },
      {
        onSettled: () => {
          void utils.dinner.dinners.invalidate();
        },
      },
    );
  }

  function deleteDinner(values: z.infer<typeof dinnerFormSchema>) {
    posthog.capture("delete dinner", { dinnerName: values.name });

    if (!existingDinner) {
      return;
    }

    deleteDinnerMutation.mutate(
      {
        dinnerId: existingDinner.id,
        secret: localStorage.getItem("sulten-secret"),
      },
      {
        onSettled: () => {
          void utils.dinner.dinners.invalidate();
        },
      },
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(updateDinner)} className="space-y-8">
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
            onClick={form.handleSubmit(deleteDinner)}
          >
            Delete
          </Button>
        </div>
      </form>
    </Form>
  );
};

const dinnerFormSchema = z.object({
  name: z.string().min(1),
  tags: z.array(z.string()),
  newTag: asOptionalStringWithoutEmpty(z.string().max(20).min(1)),
  link: asOptionalStringWithoutEmpty(z.string().url()),
  notes: asOptionalStringWithoutEmpty(z.string()),
});
