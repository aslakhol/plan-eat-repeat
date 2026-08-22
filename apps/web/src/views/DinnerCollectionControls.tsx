import { FilterIcon, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalScrollViewport,
  ResponsiveModalTitle,
} from "~/components/ResponsiveModal";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  buildDinnerTagGroups,
  filterDinnerSummaries,
  matchesDinnerCollectionText,
  type CookbookSort,
  type DinnerTagCount,
} from "~/lib/cookbook";
import { cn } from "~/lib/utils";

type CollectionDinner = {
  name: string;
  tags: ReadonlyArray<{ value: string }>;
};

type SortOption<Sort extends string> = {
  value: Sort;
  label: string;
};

const cookbookSortOptions: readonly SortOption<CookbookSort>[] = [
  { value: "az", label: "A–Z" },
  { value: "not-lately", label: "Haven't had lately" },
  { value: "favourites", label: "Favourites" },
];

type Props<Sort extends string> = {
  dinners: readonly CollectionDinner[];
  tagVocabularyDinners?: readonly CollectionDinner[];
  search: string;
  onSearchChange: (search: string) => void;
  selectedTags: string[];
  onSelectedTagsChange: (tags: string[]) => void;
  sort: Sort;
  onSortChange: (sort: Sort) => void;
  placeholder?: string;
  sortOptions?: readonly SortOption<Sort>[];
  className?: string;
};

export const DinnerCollectionControls = <Sort extends string = CookbookSort>({
  dinners,
  tagVocabularyDinners = dinners,
  search,
  onSearchChange,
  selectedTags,
  onSelectedTagsChange,
  sort,
  onSortChange,
  placeholder = "Search dinners…",
  sortOptions = cookbookSortOptions as readonly SortOption<Sort>[],
  className,
}: Props<Sort>) => {
  const [tagFilterOpen, setTagFilterOpen] = useState(false);
  const [draftTags, setDraftTags] = useState<string[]>(selectedTags);
  const [tagSearch, setTagSearch] = useState("");
  const hasTagFilterHistoryEntry = useRef(false);

  useEffect(() => {
    const closeTagFilterOnBack = () => {
      if (!hasTagFilterHistoryEntry.current) return;

      hasTagFilterHistoryEntry.current = false;
      setTagFilterOpen(false);
    };

    window.addEventListener("popstate", closeTagFilterOnBack);
    return () => window.removeEventListener("popstate", closeTagFilterOnBack);
  }, []);

  const openTagFilter = () => {
    setDraftTags(selectedTags);
    setTagSearch("");
    window.history.pushState(window.history.state, "", window.location.href);
    hasTagFilterHistoryEntry.current = true;
    setTagFilterOpen(true);
  };

  const closeTagFilter = () => {
    if (hasTagFilterHistoryEntry.current) {
      window.history.back();
      return;
    }

    setTagFilterOpen(false);
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex w-full items-center gap-2">
        <Input
          type="search"
          aria-label={placeholder.replace("…", "")}
          placeholder={placeholder}
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="h-11 min-w-0 rounded-full bg-white px-4"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Filter by tags"
          aria-haspopup="dialog"
          aria-expanded={tagFilterOpen}
          className={cn(
            "h-11 w-11 shrink-0 rounded-lg",
            selectedTags.length > 0 &&
              "border-primary bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
          )}
          onClick={openTagFilter}
        >
          <FilterIcon />
        </Button>
      </div>

      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="Active tag filters">
          {selectedTags.map((tag) => (
            <ActiveTagChip
              key={tag}
              tag={tag}
              onRemove={() =>
                onSelectedTagsChange(
                  selectedTags.filter((selectedTag) => selectedTag !== tag),
                )
              }
            />
          ))}
        </div>
      )}

      <div className="bg-muted grid grid-cols-3 gap-1 rounded-lg p-1">
        {sortOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={sort === option.value}
            onClick={() => onSortChange(option.value)}
            className={cn(
              "text-muted-foreground min-w-0 rounded-md px-1 py-2 text-[10px] font-bold transition-colors sm:text-[11px]",
              sort === option.value && "text-primary bg-white shadow-sm",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <TagFilterSheet
        open={tagFilterOpen}
        onOpenChange={(open) => {
          if (!open) closeTagFilter();
        }}
        dinners={dinners}
        tagVocabularyDinners={tagVocabularyDinners}
        draftTags={draftTags}
        onDraftTagsChange={setDraftTags}
        tagSearch={tagSearch}
        onTagSearchChange={setTagSearch}
        onApply={() => {
          onSelectedTagsChange(draftTags);
          closeTagFilter();
        }}
      />
    </div>
  );
};

const ActiveTagChip = ({
  tag,
  onRemove,
}: {
  tag: string;
  onRemove: () => void;
}) => (
  <button
    type="button"
    aria-label={`Remove ${tag} filter`}
    onClick={onRemove}
    className="border-primary bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold"
  >
    {tag}
    <X className="size-3.5" />
  </button>
);

type TagFilterSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dinners: readonly CollectionDinner[];
  tagVocabularyDinners: readonly CollectionDinner[];
  draftTags: string[];
  onDraftTagsChange: (tags: string[]) => void;
  tagSearch: string;
  onTagSearchChange: (search: string) => void;
  onApply: () => void;
};

const TagFilterSheet = ({
  open,
  onOpenChange,
  dinners,
  tagVocabularyDinners,
  draftTags,
  onDraftTagsChange,
  tagSearch,
  onTagSearchChange,
  onApply,
}: TagFilterSheetProps) => {
  const groups = buildDinnerTagGroups(tagVocabularyDinners, draftTags);
  const mostUsed = groups.mostUsed.filter((tag) =>
    matchesDinnerCollectionText(tag.value, tagSearch),
  );
  const all = groups.all.filter((tag) =>
    matchesDinnerCollectionText(tag.value, tagSearch),
  );
  const matchingCount = filterDinnerSummaries(dinners, "", draftTags).length;
  const toggleTag = (tag: string) => {
    onDraftTagsChange(
      draftTags.includes(tag)
        ? draftTags.filter((selectedTag) => selectedTag !== tag)
        : [...draftTags, tag],
    );
  };

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent className="flex h-[min(88dvh,760px)] max-h-[88dvh] flex-col overflow-hidden bg-white md:max-w-xl">
        <ResponsiveModalTitle className="sr-only">
          Filter Dinners by tag
        </ResponsiveModalTitle>
        <ResponsiveModalDescription className="sr-only">
          Choose one or more tags. Dinners must match every selected tag.
        </ResponsiveModalDescription>

        <Input
          autoFocus
          type="search"
          aria-label="Search tags"
          placeholder="Search tags…"
          value={tagSearch}
          onChange={(event) => onTagSearchChange(event.target.value)}
          className="h-11 shrink-0 rounded-full bg-white px-4"
        />

        <ResponsiveModalScrollViewport className="min-h-0 flex-1 space-y-7 py-5">
          {groups.selected.length > 0 && (
            <TagSection label="Selected">
              {groups.selected.map((tag) => (
                <TagChoice
                  key={tag.value}
                  tag={tag}
                  selected
                  onClick={() => toggleTag(tag.value)}
                />
              ))}
              <button
                type="button"
                onClick={() => onDraftTagsChange([])}
                className="text-muted-foreground rounded-full border border-dashed px-3 py-1.5 text-xs font-semibold"
              >
                Clear all
              </button>
            </TagSection>
          )}

          {mostUsed.length > 0 && (
            <TagSection label="Most used">
              {mostUsed.map((tag) => (
                <TagChoice
                  key={tag.value}
                  tag={tag}
                  onClick={() => toggleTag(tag.value)}
                />
              ))}
            </TagSection>
          )}

          {all.length > 0 && (
            <TagSection label="All tags">
              {all.map((tag) => (
                <TagChoice
                  key={tag.value}
                  tag={tag}
                  onClick={() => toggleTag(tag.value)}
                />
              ))}
            </TagSection>
          )}

          {mostUsed.length === 0 && all.length === 0 && (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No tags match.
            </p>
          )}
        </ResponsiveModalScrollViewport>

        <Button
          type="button"
          onClick={onApply}
          className="h-12 w-full shrink-0 rounded-xl text-sm font-bold"
        >
          Show {matchingCount} {matchingCount === 1 ? "dinner" : "dinners"}
        </Button>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
};

const TagSection = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <section className="space-y-3">
    <h2 className="text-muted-foreground text-xs font-bold uppercase tracking-wider">
      {label}
    </h2>
    <div className="flex flex-wrap gap-2">{children}</div>
  </section>
);

const TagChoice = ({
  tag,
  selected = false,
  onClick,
}: {
  tag: DinnerTagCount;
  selected?: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    aria-pressed={selected}
    onClick={onClick}
    className={cn(
      "text-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold",
      selected && "border-primary bg-primary/10 text-primary",
    )}
  >
    <span>{tag.value}</span>
    {selected ? (
      <X className="size-3.5" />
    ) : (
      <span className="text-muted-foreground">{tag.count}</span>
    )}
  </button>
);
