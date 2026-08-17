import { formatAmount } from "@planeatrepeat/shared";

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

export const publishedDinnerPath = (publicSlug: string) => `/d/${publicSlug}`;

export const publishedDinnerUrl = (publicSlug: string, appUrl: string) =>
  new URL(publishedDinnerPath(publicSlug), appUrl).toString();

const publicationDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

export const formatPublicationDate = (publishedAt: string) =>
  publicationDateFormatter.format(new Date(publishedAt));

type RecipeInstruction =
  | { readonly "@type": "HowToStep"; readonly text: string }
  | {
      readonly "@type": "HowToSection";
      readonly name: string;
      readonly itemListElement: Array<{
        readonly "@type": "HowToStep";
        readonly text: string;
      }>;
    };

export const publishedDinnerRecipeJsonLd = (dinner: PublishedDinner) => {
  const recipeIngredient = dinner.parts.flatMap((part) =>
    part.ingredients.map((ingredient) => {
      const amount = [
        ingredient.amount === null ? "" : formatAmount(ingredient.amount),
        ingredient.unit ?? "",
      ]
        .filter(Boolean)
        .join(" ");

      const ingredientName = [amount, ingredient.name]
        .filter(Boolean)
        .join(" ");
      return ingredient.note
        ? `${ingredientName}, ${ingredient.note}`
        : ingredientName;
    }),
  );
  const recipeInstructions = dinner.parts.flatMap<RecipeInstruction>((part) => {
    const steps = part.steps
      .filter((step) => step.trim().length > 0)
      .map((step) => ({ "@type": "HowToStep", text: step }) as const);

    if (steps.length === 0) return [];
    if (!part.name) return steps;
    return [
      {
        "@type": "HowToSection" as const,
        name: part.name,
        itemListElement: steps,
      },
    ];
  });

  if (recipeIngredient.length === 0 && recipeInstructions.length === 0) {
    return null;
  }

  return {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: dinner.name,
    author: { "@type": "Organization", name: dinner.householdName },
    datePublished: dinner.publishedAt,
    ...(dinner.notes ? { description: dinner.notes } : {}),
    ...(dinner.tags.length > 0 ? { keywords: dinner.tags.join(", ") } : {}),
    ...(dinner.servings === null
      ? {}
      : { recipeYield: `${dinner.servings} servings` }),
    ...(recipeIngredient.length > 0 ? { recipeIngredient } : {}),
    ...(recipeInstructions.length > 0 ? { recipeInstructions } : {}),
  };
};

export const serializePublishedDinnerRecipeJsonLd = (
  dinner: PublishedDinner,
) => {
  const jsonLd = publishedDinnerRecipeJsonLd(dinner);
  if (!jsonLd) return null;

  return JSON.stringify(jsonLd)
    .replaceAll("&", "\\u0026")
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
};

const publishedDinnerUpsells = [
  "Never wonder what's for dinner.",
  "All your recipes in one place.",
  "Stop screenshotting recipes.",
  "All your meal planning in five minutes.",
  "Rescue your recipes from the group chat.",
  "Fewer trips to the shop at half five.",
  "Fewer hungry trips to the shop.",
  "No more “whats for dinner”",
  "Everyone knows whats for dinner.",
] as const;

export const pickPublishedDinnerUpsell = (random = Math.random) =>
  publishedDinnerUpsells[
    Math.min(
      Math.floor(random() * publishedDinnerUpsells.length),
      publishedDinnerUpsells.length - 1,
    )
  ] ?? publishedDinnerUpsells[0];
