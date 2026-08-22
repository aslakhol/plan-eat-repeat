import { matchesDinnerCollectionText } from "~/lib/cookbook";
import { publicSlugForName } from "~/lib/public-slug";

export type PublicDinnerListSort = "recent" | "az" | "most-saved";

export type PublicDinnerListDinner = {
  name: string;
  publicSlug: string;
  publishedAt: string;
  saveCount: number;
  tags: readonly string[];
};

const publicDinnerNameCollator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});

const comparePublicDinnerNames = (
  left: PublicDinnerListDinner,
  right: PublicDinnerListDinner,
) =>
  publicDinnerNameCollator.compare(left.name, right.name) ||
  left.publicSlug.localeCompare(right.publicSlug);

const compareRecentlyShared = (
  left: PublicDinnerListDinner,
  right: PublicDinnerListDinner,
) =>
  Date.parse(right.publishedAt) - Date.parse(left.publishedAt) ||
  comparePublicDinnerNames(left, right);

export const derivePublicDinnerList = <Dinner extends PublicDinnerListDinner>(
  dinners: readonly Dinner[],
  controls: {
    search: string;
    selectedTags: readonly string[];
    sort: PublicDinnerListSort;
  },
) => {
  const filtered = dinners.filter((dinner) => {
    const matchesSearch =
      matchesDinnerCollectionText(dinner.name, controls.search) ||
      dinner.tags.some((tag) =>
        matchesDinnerCollectionText(tag, controls.search),
      );
    const matchesTags = controls.selectedTags.every((selectedTag) =>
      dinner.tags.includes(selectedTag),
    );
    return matchesSearch && matchesTags;
  });
  const ordered = [...filtered].sort((left, right) => {
    if (controls.sort === "az") return comparePublicDinnerNames(left, right);
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

export type PublicDinnerList = {
  publicSlug: string;
  householdName: string;
  dinners: PublicDinnerListDinner[];
};

export const publicSlugForHousehold = (name: string, publicId: string) =>
  publicSlugForName(name, publicId, "household");

export const publicDinnerListPath = (publicSlug: string) => `/h/${publicSlug}`;

export const publicDinnerListUrl = (publicSlug: string, appUrl: string) =>
  new URL(publicDinnerListPath(publicSlug), appUrl).toString();
