import { type Dispatch, type SetStateAction } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { cn } from "../lib/utils";
import { FilterIcon } from "lucide-react";
import { api } from "../utils/api";

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
    <div className="flex flex-wrap gap-2">
      {filtersQuery.data?.tags.map((tag) => (
        <div
          key={tag.value}
          className={cn(
            "cursor-pointer rounded border border-green-100 bg-green-100 px-2 py-1 text-green-800 hover:bg-green-300",
            selectedTags.includes(tag.value) &&
              "border border-green-400 bg-green-200 ",
          )}
          onClick={() => {
            if (selectedTags.includes(tag.value)) {
              setSelectedTags((prev) => prev.filter((t) => t !== tag.value));
              return;
            }
            setSelectedTags((prev) => [...prev, tag.value]);
          }}
        >
          {tag.value}
        </div>
      ))}
    </div>
  );
};
