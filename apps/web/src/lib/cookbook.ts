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

const dinnerNameCollator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});

const compareDinnerNames = (
  left: OrderableDinnerSummary,
  right: OrderableDinnerSummary,
) => dinnerNameCollator.compare(left.name, right.name) || left.id - right.id;

const weekdayFormatter = new Intl.DateTimeFormat("en", { weekday: "long" });

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
  const normalisedSearch = search.trim().toLocaleLowerCase();

  return dinners.filter((dinner) => {
    const matchesSearch =
      normalisedSearch.length === 0 ||
      dinner.name.toLocaleLowerCase().includes(normalisedSearch) ||
      dinner.tags.some((tag) =>
        tag.value.toLocaleLowerCase().includes(normalisedSearch),
      );
    const matchesTags = selectedTags.every((selectedTag) =>
      dinner.tags.some((tag) => tag.value === selectedTag),
    );

    return matchesSearch && matchesTags;
  });
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
