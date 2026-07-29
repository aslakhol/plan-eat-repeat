import * as React from "react";
import { FancyCombobox, Label } from "@planeatrepeat/web";

type Tag = { value: string; label: string };

const asTags = (values: string[]): Tag[] =>
  values.map((value) => ({ value, label: value }));

// Kept short on purpose: the option list is capped at 35dvh, and a taller
// list would be cut mid-row in the preview card.
const householdTags = asTags([
  "Vegetarian",
  "20 min",
  "Family favourite",
  "Friday",
  "Leftovers",
]);

const useTagState = (initial: string[]) => {
  const [selected, setSelected] = React.useState<Tag[]>(asTags(initial));

  return {
    selected,
    select: (option: Tag) => setSelected((current) => [...current, option]),
    unselect: (option: Tag) =>
      setSelected((current) =>
        current.filter((tag) => tag.value !== option.value),
      ),
    removeLast: () => setSelected((current) => current.slice(0, -1)),
    createNew: (value: string) =>
      setSelected((current) => [...current, { value, label: value }]),
  };
};

export const WithTags = () => {
  const tags = useTagState(["Vegetarian", "20 min"]);

  return (
    <div className="w-80 space-y-2">
      <Label>Tags</Label>
      <FancyCombobox
        options={householdTags}
        placeholder="Add tag…"
        {...tags}
      />
    </div>
  );
};

export const Empty = () => {
  const tags = useTagState([]);

  return (
    <div className="w-80 space-y-2">
      <Label>Tags</Label>
      <FancyCombobox
        options={householdTags}
        placeholder="Add tag…"
        {...tags}
      />
    </div>
  );
};

// The dropdown is driven by the input's own focus state — there is no `open`
// prop — so the story focuses the input on mount to show the option list.
export const OpenOptions = () => {
  const tags = useTagState(["Vegetarian"]);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    containerRef.current?.querySelector("input")?.focus();
  }, []);

  return (
    <div ref={containerRef} className="w-80 space-y-2">
      <Label>Tags</Label>
      <FancyCombobox
        options={householdTags}
        placeholder="Add tag…"
        {...tags}
      />
    </div>
  );
};
