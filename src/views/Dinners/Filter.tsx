import { useState } from "react";
import { api } from "../../utils/api";
import { cn } from "../../lib/utils";

type Props = {};

export const Filter = () => {
  const filtersQuery = api.dinner.tags.useQuery();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

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
