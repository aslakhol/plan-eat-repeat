import { View, Text } from "react-native";
import { Filter as FilterIcon, X } from "lucide-react-native";
import { api } from "../utils/api";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Badge } from "./ui/Badge";
import { cn } from "../utils/cn";
import { colors } from "../theme/colors";

type Props = {
  search: string;
  setSearch: (search: string) => void;
  showTags: boolean;
  setShowTags: React.Dispatch<React.SetStateAction<boolean>>;
  selectedTags: string[];
  setSelectedTags: React.Dispatch<React.SetStateAction<string[]>>;
  className?: string;
};

export function Filter({
  search,
  setSearch,
  showTags,
  setShowTags,
  selectedTags,
  setSelectedTags,
  className,
}: Props) {
  return (
    <View className={cn("gap-2", className)}>
      <View className="flex-row items-center gap-2">
        <Input
          placeholder="Search..."
          value={search}
          onChangeText={setSearch}
          className="h-10 flex-1"
        />
        <Button
          variant="outline"
          onPress={() => setShowTags(!showTags)}
          className="h-10 w-10 items-center justify-center rounded-md p-0"
        >
          <FilterIcon
            size={16}
            color={colors.foreground}
            style={showTags ? { transform: [{ rotate: "180deg" }] } : undefined}
          />
        </Button>
      </View>
      {showTags && (
        <Tags selectedTags={selectedTags} setSelectedTags={setSelectedTags} />
      )}
    </View>
  );
}

type TagsProps = {
  selectedTags: string[];
  setSelectedTags: React.Dispatch<React.SetStateAction<string[]>>;
};

function Tags({ selectedTags, setSelectedTags }: TagsProps) {
  const filtersQuery = api.dinner.tags.useQuery();

  return (
    <View className="flex-row flex-wrap gap-2">
      {filtersQuery.data?.tags.map((tag) => (
        <Badge
          key={tag.value}
          variant="secondary"
          className={cn(
            "border border-transparent",
            selectedTags.includes(tag.value) && "border-primary bg-primary/10",
          )}
          onPress={() => {
            if (selectedTags.includes(tag.value)) {
              setSelectedTags((prev) => prev.filter((t) => t !== tag.value));
            } else {
              setSelectedTags((prev) => [...prev, tag.value]);
            }
          }}
        >
          {tag.value}
        </Badge>
      ))}
      <Badge
        variant="secondary"
        onPress={() => setSelectedTags([])}
        className="bg-secondary"
      >
        <Text className="text-xs font-medium text-secondary-foreground">
          Clear filters
        </Text>
        <X size={12} color={colors.mutedForeground} />
      </Badge>
    </View>
  );
}
