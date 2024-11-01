import { type Dispatch, type SetStateAction } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { cn } from "../lib/utils";
import { FilterIcon, X } from "lucide-react";
import { api } from "../utils/api";
import { Badge } from "../components/ui/badge";

type Props = {
  search: string;
  setSearch: (search: string) => void;
  showTags: boolean;
  setShowTags: Dispatch<SetStateAction<boolean>>;
  selectedTags: string[];
  setSelectedTags: Dispatch<SetStateAction<string[]>>;
  className?: string;
};

export const Filter = ({
  search,
  setSearch,
  showTags,
  setShowTags,
  selectedTags,
  setSelectedTags,
  className,
}: Props) => {
  return (
    <div className={cn(className)}>
      <div className="flex w-full items-center space-x-2">
        <Input
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button
          type="button"
          variant={"outline"}
          className={cn(
            "transition-all duration-300",
            showTags && "rotate-180",
          )}
          onClick={() => setShowTags(!showTags)}
        >
          <FilterIcon />
        </Button>
      </div>
      {showTags && (
        <Tags selectedTags={selectedTags} setSelectedTags={setSelectedTags} />
      )}
    </div>
  );
};

type TagsProps = {
  selectedTags: string[];
  setSelectedTags: Dispatch<SetStateAction<string[]>>;
};

const Tags = ({ selectedTags, setSelectedTags }: TagsProps) => {
  const filtersQuery = api.dinner.tags.useQuery();

  return (
    <div className="flex flex-wrap gap-2 pt-2">
      {filtersQuery.data?.tags.map((tag) => (
        <Badge
          key={tag.value}
          variant="secondary"
          className={cn(
            "cursor-pointer hover:bg-secondary-foreground/10",
            selectedTags.includes(tag.value) &&
              "border border-secondary-foreground/50",
          )}
          onClick={() => {
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
        className={cn("cursor-pointer hover:bg-secondary-foreground/10")}
        onClick={() => setSelectedTags([])}
      >
        Clear filters
        <X className="ml-1 h-3 w-3 text-muted-foreground hover:text-foreground" />
      </Badge>
    </div>
  );
};
