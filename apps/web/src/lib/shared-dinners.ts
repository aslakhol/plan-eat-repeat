import { compareDinnerNames, filterDinnerSummaries } from "~/lib/cookbook";

export type SharedDinnerSort = "recent" | "az" | "most-saved";

type SharedDinnerSummary = {
  id: number;
  name: string;
  tags: ReadonlyArray<{ value: string }>;
  publishedAt: Date;
  saveCount: number;
};

export const sharedDinnerSortOptions = [
  { value: "recent", label: "Recently shared" },
  { value: "az", label: "A–Z" },
  { value: "most-saved", label: "Most saved" },
] as const satisfies ReadonlyArray<{
  value: SharedDinnerSort;
  label: string;
}>;

const compareRecentlyShared = (
  left: SharedDinnerSummary,
  right: SharedDinnerSummary,
) =>
  right.publishedAt.getTime() - left.publishedAt.getTime() ||
  compareDinnerNames(left, right);

export const deriveSharedDinnerCollection = <
  Dinner extends SharedDinnerSummary,
>(
  dinners: readonly Dinner[],
  controls: {
    search: string;
    selectedTags: readonly string[];
    sort: SharedDinnerSort;
  },
) => {
  const filtered = filterDinnerSummaries(
    dinners,
    controls.search,
    controls.selectedTags,
  );
  const ordered = [...filtered].sort((left, right) => {
    if (controls.sort === "az") return compareDinnerNames(left, right);
    if (controls.sort === "most-saved") {
      return (
        right.saveCount - left.saveCount || compareRecentlyShared(left, right)
      );
    }
    return compareRecentlyShared(left, right);
  });

  return {
    dinners: ordered,
    emptyState:
      dinners.length === 0
        ? ("empty" as const)
        : ordered.length === 0
          ? ("no-matches" as const)
          : null,
  };
};

const shortDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const datedYearFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export const formatSharedDinnerDate = (publishedAt: Date, now = new Date()) =>
  publishedAt.getUTCFullYear() === now.getUTCFullYear()
    ? shortDateFormatter.format(publishedAt)
    : datedYearFormatter.format(publishedAt);

export const formatSharedDinnerMeta = (
  dinner: Pick<SharedDinnerSummary, "publishedAt" | "saveCount">,
  now = new Date(),
) => {
  const shared = `Shared ${formatSharedDinnerDate(dinner.publishedAt, now)}`;
  return dinner.saveCount > 0
    ? `${shared} · saved by ${dinner.saveCount}`
    : shared;
};
