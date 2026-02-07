import { useState } from "react";
import { View, Text, Alert } from "react-native";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { dinnerFormSchema, type DinnerWithTags } from "@planeatrepeat/shared";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Textarea } from "../ui/Textarea";
import { Badge } from "../ui/Badge";
import { api } from "../../utils/api";

type DinnerFormValues = {
  name: string;
  tags: string[];
  newTag?: string;
  link?: string;
  notes?: string;
};

type Props = {
  existingDinner?: DinnerWithTags | null;
  onSubmit: (values: DinnerFormValues) => void;
  onDelete?: (values: DinnerFormValues) => void;
  onCancel: () => void;
  isPending: boolean;
};

export function DinnerForm({
  existingDinner,
  onSubmit,
  onDelete,
  onCancel,
  isPending,
}: Props) {
  const form = useForm<DinnerFormValues>({
    resolver: zodResolver(dinnerFormSchema),
    defaultValues: {
      name: existingDinner?.name ?? "",
      tags: existingDinner?.tags.map((tag) => tag.value) ?? [],
      newTag: "",
      link: existingDinner?.link ?? "",
      notes: existingDinner?.notes ?? "",
    },
  });

  const [tagInput, setTagInput] = useState("");
  const { data: existingTags } = api.dinner.tags.useQuery(undefined, {
    select: (data) => data.tags.map((tag) => tag.value),
  });

  const tags = form.watch("tags");

  const addTag = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    form.setValue("tags", [...tags, trimmed]);
    setTagInput("");
  };

  const removeTag = (value: string) => {
    form.setValue(
      "tags",
      tags.filter((tag) => tag !== value),
    );
  };

  const handleDelete = () => {
    if (!onDelete) return;
    Alert.alert("Delete dinner", "Are you sure you want to delete this dinner?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => form.handleSubmit(onDelete)(),
      },
    ]);
  };

  return (
    <View className="gap-5">
      <Controller
        control={form.control}
        name="name"
        render={({ field }) => (
          <View className="gap-2">
            <Text className="text-sm font-medium text-foreground">Name</Text>
            <Input value={field.value} onChangeText={field.onChange} />
          </View>
        )}
      />

      <View className="gap-2">
        <Text className="text-sm font-medium text-foreground">Tags</Text>
        <View className="flex-row flex-wrap gap-2">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" onPress={() => removeTag(tag)}>
              {tag}
            </Badge>
          ))}
        </View>
        <View className="flex-row gap-2">
          <Input
            value={tagInput}
            onChangeText={setTagInput}
            placeholder="Add tag"
            className="flex-1"
          />
          <Button
            variant="outline"
            onPress={() => addTag(tagInput)}
            disabled={!tagInput.trim()}
          >
            Add
          </Button>
        </View>
        {!!existingTags?.length && (
          <View className="flex-row flex-wrap gap-2">
            {existingTags.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                onPress={() => addTag(tag)}
              >
                {tag}
              </Badge>
            ))}
          </View>
        )}
      </View>

      <Controller
        control={form.control}
        name="link"
        render={({ field }) => (
          <View className="gap-2">
            <Text className="text-sm font-medium text-foreground">Link</Text>
            <Input value={field.value} onChangeText={field.onChange} />
          </View>
        )}
      />

      <Controller
        control={form.control}
        name="notes"
        render={({ field }) => (
          <View className="gap-2">
            <Text className="text-sm font-medium text-foreground">Notes</Text>
            <Textarea value={field.value} onChangeText={field.onChange} />
          </View>
        )}
      />

      <View className="flex-row flex-wrap gap-2">
        <Button onPress={form.handleSubmit(onSubmit)} disabled={isPending}>
          Save
        </Button>
        {existingDinner && onDelete && (
          <Button variant="destructive" onPress={handleDelete} disabled={isPending}>
            Delete
          </Button>
        )}
        <Button variant="outline" onPress={onCancel}>
          Cancel
        </Button>
      </View>
    </View>
  );
}
