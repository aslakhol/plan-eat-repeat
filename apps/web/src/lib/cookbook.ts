import { differenceInCalendarISOWeeks } from "date-fns";

export type CookbookSort = "az" | "not-lately" | "favourites";

type DinnerSummaryLabelInput = {
  today: Date;
  lastCookedDate: Date | null;
  currentWeekPlanDates: readonly Date[];
};

type OrderableDinnerSummary = {
  id: number;
  name: string;
  favourite: boolean;
  cookingFrequency: number;
  lastCookedDate: Date | null;
};

type FilterableDinnerSummary = {
  name: string;
  tags: ReadonlyArray<{ value: string }>;
};

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

const compareDinnerNames = (
  left: OrderableDinnerSummary,
  right: OrderableDinnerSummary,
) => dinnerNameCollator.compare(left.name, right.name) || left.id - right.id;

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

    return matchesSearch && matchesTags;
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
    sort: CookbookSort;
  },
) => {
  const hasActiveFilters =
    normaliseCollectionText(controls.search).length > 0 ||
    controls.selectedTags.length > 0;
  const matchingDinners = filterDinnerSummaries(
    dinners,
    controls.search,
    controls.selectedTags,
  );

  return {
    dinners: orderDinnerSummaries(matchingDinners, controls.sort),
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
