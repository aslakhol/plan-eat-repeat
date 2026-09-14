import { differenceInCalendarISOWeeks } from "date-fns";

export type CookbookSort = "az" | "not-lately" | "favourites";

type DinnerSummaryLabelInput = {
  today: Date;
  lastCookedDate: Date | null;
  currentWeekPlanDates: readonly Date[];
};

type NamedDinner = {
  id: number;
  name: string;
};

type OrderableDinnerSummary = NamedDinner & {
  favourite: boolean;
  cookingFrequency: number;
  lastCookedDate: Date | null;
};

export type FilterableDinnerSummary = {
  name: string;
  tags: ReadonlyArray<{ value: string }>;
  hasLink?: boolean;
  hasNotes?: boolean;
  hasRecipe?: boolean;
};

export type DinnerContentSummary = {
  hasLink: boolean;
  hasRecipe: boolean;
  hasNotes: boolean;
};

export const dinnerContentFilterOptions = [
  { value: "has-link", label: "Has link", field: "hasLink", present: true },
  { value: "no-link", label: "No link", field: "hasLink", present: false },
  {
    value: "has-recipe",
    label: "Has recipe",
    field: "hasRecipe",
    present: true,
  },
  {
    value: "no-recipe",
    label: "No recipe",
    field: "hasRecipe",
    present: false,
  },
  { value: "has-notes", label: "Has notes", field: "hasNotes", present: true },
  { value: "no-notes", label: "No notes", field: "hasNotes", present: false },
] as const;

export type DinnerContentFilter =
  (typeof dinnerContentFilterOptions)[number]["value"];

export const toggleDinnerContentFilter = (
  selected: readonly DinnerContentFilter[],
  value: DinnerContentFilter,
): DinnerContentFilter[] => {
  const option = dinnerContentFilterOptions.find(
    (option) => option.value === value,
  )!;
  const remaining = selected.filter(
    (selectedValue) =>
      !dinnerContentFilterOptions.some(
        (other) =>
          other.value === selectedValue && other.field === option.field,
      ),
  );
  return selected.includes(value) ? remaining : [...remaining, value];
};

export const matchesDinnerContentFilters = (
  dinner: Pick<FilterableDinnerSummary, "hasLink" | "hasNotes" | "hasRecipe">,
  selected: readonly DinnerContentFilter[],
) =>
  dinnerContentFilterOptions.every((option) => {
    if (!selected.includes(option.value)) return true;
    const present = Boolean(dinner[option.field]);
    return present === option.present;
  });

export type DinnerTagCount = {
  value: string;
  count: number;
};

export type DinnerTagGroups = {
  selected: DinnerTagCount[];
  mostUsed: DinnerTagCount[];
  all: DinnerTagCount[];
};

const dinnerNameCollator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});

export const compareDinnerNames = (left: NamedDinner, right: NamedDinner) =>
  dinnerNameCollator.compare(left.name, right.name) || left.id - right.id;

const weekdayFormatter = new Intl.DateTimeFormat("en", { weekday: "long" });

const normaliseCollectionText = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();

export const matchesDinnerCollectionText = (value: string, search: string) => {
  const normalisedSearch = normaliseCollectionText(search);
  return (
    normalisedSearch.length === 0 ||
    normaliseCollectionText(value).includes(normalisedSearch)
  );
};

const isSameLocalDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

export const formatDinnerSummaryLabel = ({
  today,
  lastCookedDate,
  currentWeekPlanDates,
}: DinnerSummaryLabelInput): string => {
  if (currentWeekPlanDates.some((date) => isSameLocalDay(date, today))) {
    return "tonight";
  }

  const upcomingDate = currentWeekPlanDates
    .filter((date) => date > today)
    .sort((left, right) => left.getTime() - right.getTime())[0];
  if (upcomingDate) return weekdayFormatter.format(upcomingDate);

  const pastDate = currentWeekPlanDates
    .filter((date) => date < today)
    .sort((left, right) => right.getTime() - left.getTime())[0];
  if (pastDate) return weekdayFormatter.format(pastDate);

  if (lastCookedDate === null) return "never made";

  const weeksAgo = differenceInCalendarISOWeeks(today, lastCookedDate);
  if (weeksAgo === 0) return "this week";
  if (weeksAgo === 1) return "1 wk ago";
  if (weeksAgo <= 52) return `${weeksAgo} wks ago`;
  return "over a year ago";
};

export const filterDinnerSummaries = <Dinner extends FilterableDinnerSummary>(
  dinners: readonly Dinner[],
  search: string,
  selectedTags: readonly string[],
  selectedContentFilters: readonly DinnerContentFilter[] = [],
): Dinner[] => {
  const normalisedSearch = normaliseCollectionText(search);

  return dinners.filter((dinner) => {
    const matchesSearch =
      matchesDinnerCollectionText(dinner.name, normalisedSearch) ||
      dinner.tags.some((tag) =>
        matchesDinnerCollectionText(tag.value, normalisedSearch),
      );
    const matchesTags = selectedTags.every((selectedTag) =>
      dinner.tags.some((tag) => tag.value === selectedTag),
    );

    return (
      matchesSearch &&
      matchesTags &&
      matchesDinnerContentFilters(dinner, selectedContentFilters)
    );
  });
};

export const buildDinnerTagGroups = (
  dinners: readonly FilterableDinnerSummary[],
  selectedTags: readonly string[],
): DinnerTagGroups => {
  const tagCounts = new Map<string, number>();

  for (const dinner of dinners) {
    const dinnerTags = new Set(dinner.tags.map((tag) => tag.value));
    for (const tag of dinnerTags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  const allTags = [...tagCounts].map(([value, count]) => ({ value, count }));
  const selectedTagSet = new Set(selectedTags);
  const compareTagNames = (left: DinnerTagCount, right: DinnerTagCount) =>
    dinnerNameCollator.compare(left.value, right.value);
  const compareTagsByUsage = (left: DinnerTagCount, right: DinnerTagCount) =>
    right.count - left.count || compareTagNames(left, right);
  const mostUsedValues = new Set(
    [...allTags]
      .sort(compareTagsByUsage)
      .slice(0, 8)
      .map((tag) => tag.value),
  );

  return {
    selected: selectedTags.flatMap((value) => {
      const count = tagCounts.get(value);
      return count === undefined ? [] : [{ value, count }];
    }),
    mostUsed: allTags
      .filter(
        (tag) =>
          mostUsedValues.has(tag.value) && !selectedTagSet.has(tag.value),
      )
      .sort(compareTagsByUsage),
    all: allTags
      .filter(
        (tag) =>
          !mostUsedValues.has(tag.value) && !selectedTagSet.has(tag.value),
      )
      .sort(compareTagNames),
  };
};

export const orderDinnerSummaries = <Dinner extends OrderableDinnerSummary>(
  dinners: readonly Dinner[],
  sort: CookbookSort,
): Dinner[] => {
  if (sort === "az") {
    return [...dinners].sort(compareDinnerNames);
  }

  if (sort === "not-lately") {
    return [...dinners].sort((left, right) => {
      if (left.lastCookedDate === null && right.lastCookedDate !== null) {
        return -1;
      }
      if (left.lastCookedDate !== null && right.lastCookedDate === null) {
        return 1;
      }
      if (left.lastCookedDate !== null && right.lastCookedDate !== null) {
        const dateComparison =
          left.lastCookedDate.getTime() - right.lastCookedDate.getTime();
        if (dateComparison !== 0) return dateComparison;
      }

      return compareDinnerNames(left, right);
    });
  }

  return [...dinners].sort(
    (left, right) =>
      Number(right.favourite) - Number(left.favourite) ||
      right.cookingFrequency - left.cookingFrequency ||
      compareDinnerNames(left, right),
  );
};

export type DinnerCollectionEmptyState = "empty-cookbook" | "no-matches";

export const deriveDinnerCollection = <
  Dinner extends FilterableDinnerSummary & OrderableDinnerSummary,
>(
  dinners: readonly Dinner[],
  controls: {
    search: string;
    selectedTags: readonly string[];
    selectedContentFilters?: readonly DinnerContentFilter[];
    sort: CookbookSort;
  },
) => {
  const hasActiveFilters =
    normaliseCollectionText(controls.search).length > 0 ||
    controls.selectedTags.length > 0 ||
    (controls.selectedContentFilters?.length ?? 0) > 0;
  const matchingDinners = filterDinnerSummaries(
    dinners,
    controls.search,
    controls.selectedTags,
    controls.selectedContentFilters,
  );
  const orderedDinners = orderDinnerSummaries(matchingDinners, controls.sort);
  const firstNonFavouriteIndex = orderedDinners.findIndex(
    (dinner) => !dinner.favourite,
  );
  const mostPlannedStartIndex =
    controls.sort === "favourites" &&
    firstNonFavouriteIndex > 0 &&
    firstNonFavouriteIndex < orderedDinners.length
      ? firstNonFavouriteIndex
      : null;

  return {
    dinners: orderedDinners,
    mostPlannedStartIndex,
    totalCount: dinners.length,
    matchingCount: matchingDinners.length,
    hasActiveFilters,
    emptyState:
      dinners.length === 0
        ? ("empty-cookbook" as const)
        : matchingDinners.length === 0 && hasActiveFilters
          ? ("no-matches" as const)
          : null,
  };
};

export const deriveDinnerPickerCollection = <
  Dinner extends FilterableDinnerSummary & OrderableDinnerSummary,
>(
  dinners: readonly Dinner[],
  controls: {
    excludedDinnerId?: number;
    search: string;
    selectedTags: readonly string[];
    selectedContentFilters?: readonly DinnerContentFilter[];
    sort: CookbookSort;
  },
) => {
  const availableDinners = dinners.filter(
    (dinner) => dinner.id !== controls.excludedDinnerId,
  );

  return {
    ...deriveDinnerCollection(availableDinners, controls),
    availableDinners,
  };
};
