export type PublishedDinner = {
  publicSlug: string;
  publishedAt: string;
  householdName: string;
  name: string;
  tags: string[];
  link: string | null;
  notes: string | null;
  servings: number | null;
  parts: Array<{
    name: string | null;
    ingredients: Array<{
      name: string;
      amount: number | null;
      unit: string | null;
      note: string | null;
    }>;
    steps: string[];
  }>;
};

type PublishedDinnerSource = {
  publicSlug: string;
  publishedAt: Date;
  name: string;
  link: string | null;
  notes: string | null;
  servings: number | null;
  Household: { name: string };
  tags: Array<{ value: string }>;
  parts: Array<{
    name: string | null;
    ingredients: Array<{
      name: string;
      amount: number | null;
      unit: string | null;
      note: string | null;
    }>;
    steps: Array<{ text: string }>;
  }>;
};

export const toPublishedDinner = <T extends PublishedDinnerSource>(
  dinner: T,
): PublishedDinner => ({
  publicSlug: dinner.publicSlug,
  publishedAt: dinner.publishedAt.toISOString(),
  householdName: dinner.Household.name,
  name: dinner.name,
  tags: dinner.tags.map((tag) => tag.value),
  link: dinner.link,
  notes: dinner.notes,
  servings: dinner.servings,
  parts: dinner.parts.map((part) => ({
    name: part.name,
    ingredients: part.ingredients.map((ingredient) => ({
      name: ingredient.name,
      amount: ingredient.amount,
      unit: ingredient.unit,
      note: ingredient.note,
    })),
    steps: part.steps.map((step) => step.text),
  })),
});

export const publicSlugForDinner = (name: string, publicId: string) => {
  const readableName = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

  return `${readableName || "dinner"}-${publicId}`;
};

const publicationDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

export const formatPublicationDate = (publishedAt: string) =>
  publicationDateFormatter.format(new Date(publishedAt));
