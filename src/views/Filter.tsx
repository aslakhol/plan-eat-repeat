import { type Dispatch, type SetStateAction } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { cn } from "../lib/utils";
import { Tags } from "./Dinners/Tags";
import { FilterIcon } from "lucide-react";

type Props = {
  search: string;
  setSearch: (search: string) => void;
  showTags: boolean;
  setShowTags: Dispatch<SetStateAction<boolean>>;
  selectedTags: string[];
  setSelectedTags: Dispatch<SetStateAction<string[]>>;
};

export const Filter = ({
  search,
  setSearch,
  showTags,
  setShowTags,
  selectedTags,
  setSelectedTags,
}: Props) => {
  return (
    <>
      <div className="flex w-full  items-center space-x-2">
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
    </>
  );
};
