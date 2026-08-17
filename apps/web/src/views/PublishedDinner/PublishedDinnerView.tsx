import { ExternalLink } from "lucide-react";

import { formatAmount, sourceLabel } from "@planeatrepeat/shared";

import {
  formatPublicationDate,
  type PublishedDinner,
} from "~/lib/published-dinner";

const ingredientAmount = (amount: number | null, unit: string | null) =>
  [amount === null ? "" : formatAmount(amount), unit ?? ""]
    .filter(Boolean)
    .join(" ");

const Attribution = ({ dinner }: { dinner: PublishedDinner }) => (
  <div className="text-muted-foreground flex items-center gap-2.5 text-xs font-semibold">
    <span className="bg-primary/15 text-primary flex size-[26px] shrink-0 items-center justify-center rounded-full font-bold">
      {dinner.householdName.trim().charAt(0).toUpperCase() || "P"}
    </span>
    <span>
      Shared by {dinner.householdName} ·{" "}
      {formatPublicationDate(dinner.publishedAt)}
    </span>
  </div>
);

const DinnerLink = ({ link }: { link: string }) => (
  <a
    href={link}
    target="_blank"
    rel="noopener noreferrer"
    className="text-primary inline-flex items-center gap-1 text-sm font-semibold"
  >
    {sourceLabel(link)}
    <ExternalLink className="size-3.5" />
  </a>
);

const Ingredients = ({ dinner }: { dinner: PublishedDinner }) => {
  const visibleParts = dinner.parts.filter(
    (part) => part.ingredients.length > 0,
  );
  if (visibleParts.length === 0) return null;

  return (
    <div className="space-y-5">
      {visibleParts.map((part, partIndex) => (
        <section key={`${part.name ?? "ingredients"}-${partIndex}`}>
          {part.name && (
            <h3 className="mb-2 font-serif text-lg font-normal">{part.name}</h3>
          )}
          <div className="space-y-2 text-sm leading-[1.45]">
            {part.ingredients.map((ingredient, ingredientIndex) => {
              const amount = ingredientAmount(
                ingredient.amount,
                ingredient.unit,
              );

              return (
                <div
                  key={`${ingredient.name}-${ingredientIndex}`}
                  className={
                    amount ? "grid grid-cols-[max-content_1fr] gap-x-3" : ""
                  }
                >
                  {amount && (
                    <span className="min-w-12 font-bold">{amount}</span>
                  )}
                  <span className="font-medium">
                    {ingredient.name}
                    {ingredient.note && (
                      <span className="text-muted-foreground font-normal italic">
                        {" "}
                        — {ingredient.note}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
};

const Method = ({ dinner }: { dinner: PublishedDinner }) => {
  const visibleParts = dinner.parts.filter((part) => part.steps.length > 0);
  if (visibleParts.length === 0) return null;

  return (
    <div className="space-y-5">
      {visibleParts.map((part, partIndex) => (
        <section key={`${part.name ?? "method"}-${partIndex}`}>
          {part.name && (
            <h3 className="mb-2 font-serif text-lg font-normal">{part.name}</h3>
          )}
          <ol className="space-y-2.5">
            {part.steps.map((step, stepIndex) => (
              <li
                key={`${step}-${stepIndex}`}
                className="grid grid-cols-[24px_1fr] gap-2 text-sm leading-[1.55]"
              >
                <span className="text-primary font-serif text-lg">
                  {stepIndex + 1}
                </span>
                <span className="font-medium">{step}</span>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
};

const Notes = ({
  dinner,
  hasRecipe,
}: {
  dinner: PublishedDinner;
  hasRecipe: boolean;
}) =>
  dinner.notes ? (
    <section
      className={hasRecipe ? "border-border mt-7 border-t pt-5" : "mt-7"}
    >
      {hasRecipe && (
        <h2 className="mb-1.5 font-serif text-base font-normal">Notes</h2>
      )}
      <p className="whitespace-pre-wrap text-[13.5px] font-medium leading-[1.6]">
        {dinner.notes}
      </p>
    </section>
  ) : null;

export const PublishedDinnerView = ({
  dinner,
}: {
  dinner: PublishedDinner;
}) => {
  const hasIngredients = dinner.parts.some(
    (part) => part.ingredients.length > 0,
  );
  const hasSteps = dinner.parts.some((part) => part.steps.length > 0);
  const hasRecipe = hasIngredients ? true : hasSteps;
  const hasLinkOrServings =
    dinner.link !== null ? true : dinner.servings !== null;

  return (
    <div className="min-h-screen bg-[#f2efe8] md:bg-[#faf8f5]">
      <header className="border-border hidden h-[82px] items-center border-b px-8 md:flex">
        <span className="text-primary font-serif text-2xl">
          Plan Eat Repeat
        </span>
      </header>

      <main className="mx-auto max-w-[824px] px-4 pb-8 pt-7 md:px-8 md:py-12">
        <div className="text-primary mb-6 font-serif text-2xl md:hidden">
          Plan Eat Repeat
        </div>

        <article className="border-border rounded-2xl border bg-white px-5 py-7 shadow-[0_8px_28px_rgba(60,50,40,.08)] md:rounded-none md:border-0 md:bg-transparent md:px-0 md:py-0 md:shadow-none">
          <Attribution dinner={dinner} />
          <h1 className="mt-5 font-serif text-[28px] font-normal leading-[1.15] md:mt-6 md:text-[36px]">
            {dinner.name}
          </h1>

          {(dinner.tags.length > 0 || dinner.servings !== null) && (
            <div className="mt-5 flex flex-wrap gap-2">
              {dinner.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-muted-foreground rounded-full border bg-white px-3 py-1 text-xs font-semibold"
                >
                  {tag}
                </span>
              ))}
              {dinner.servings !== null && (
                <span className="text-muted-foreground hidden rounded-full border bg-white px-3 py-1 text-xs font-semibold md:inline-flex">
                  {dinner.servings} servings
                </span>
              )}
            </div>
          )}

          {hasLinkOrServings && (
            <div className="text-muted-foreground mt-4 flex flex-wrap items-center gap-2 text-sm font-medium">
              {dinner.link && <DinnerLink link={dinner.link} />}
              {dinner.link && dinner.servings !== null && <span>·</span>}
              {dinner.servings !== null && (
                <span className="md:hidden">{dinner.servings} servings</span>
              )}
            </div>
          )}

          {hasRecipe && (
            <div className="border-border mt-7 border-t pt-7 md:grid md:grid-cols-[210px_1fr] md:gap-8">
              {hasIngredients && (
                <section>
                  <h2 className="text-muted-foreground mb-4 text-[11px] font-bold uppercase tracking-[0.14em]">
                    Ingredients
                  </h2>
                  <Ingredients dinner={dinner} />
                </section>
              )}
              {hasSteps && (
                <section
                  className={hasIngredients ? "mt-8 md:mt-0" : "md:col-start-2"}
                >
                  <h2 className="text-muted-foreground mb-4 text-[11px] font-bold uppercase tracking-[0.14em]">
                    Method
                  </h2>
                  <Method dinner={dinner} />
                </section>
              )}
            </div>
          )}

          <Notes dinner={dinner} hasRecipe={hasRecipe} />
        </article>
      </main>
    </div>
  );
};
