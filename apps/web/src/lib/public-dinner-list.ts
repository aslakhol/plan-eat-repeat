import { publicSlugForName } from "~/lib/public-slug";

export type PublicDinnerList = {
  publicSlug: string;
  householdName: string;
  dinners: Array<{
    name: string;
    publicSlug: string;
    tags: string[];
  }>;
};

export const publicSlugForHousehold = (name: string, publicId: string) =>
  publicSlugForName(name, publicId, "household");

export const publicDinnerListPath = (publicSlug: string) => `/h/${publicSlug}`;

export const publicDinnerListUrl = (publicSlug: string, appUrl: string) =>
  new URL(publicDinnerListPath(publicSlug), appUrl).toString();
