import { Fragment, type ReactNode, useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import {
  formatAmount,
  sourceLabel,
  type DinnerWithRecipe,
} from "@planeatrepeat/shared";
import { cn } from "../../lib/utils";
import { FavouriteChip } from "~/components/FavouriteMark";
import { StickyHeaderCard } from "./StickyHeaderCard";

type Props = {
  dinner: DinnerWithRecipe;
  historyLabel?: string;
  headerLabel?: string;
  headerAction?: ReactNode;
  footerActions?: ReactNode;
};

const hasAmounts = (part: DinnerWithRecipe["parts"][number]) =>
  part.ingredients.some(
    (ingredient) => ingredient.amount !== null || ingredient.unit !== null,
  );

export const RecipeView = ({
  dinner,
  historyLabel,
  headerLabel,
  headerAction,
  footerActions,
}: Props) => {
  const hasRecipe = dinner.parts.length > 0;
  const titleRef = useRef<HTMLHeadingElement>(null);
  const ingredientsRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLOListElement>(null);
  const [titleVisible, setTitleVisible] = useState(true);
  const hasIngredients = dinner.parts.some(
    (part) => part.ingredients.length > 0,
  );
  const hasSteps = dinner.parts.some((part) => part.steps.length > 0);
  const firstIngredientsPartIndex = dinner.parts.findIndex(
    (part) => part.ingredients.length > 0,
  );
  const firstStepsPartIndex = dinner.parts.findIndex(
    (part) => part.steps.length > 0,
  );

  useEffect(() => {
    const title = titleRef.current;
    if (!title || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => setTitleVisible(entry?.isIntersecting ?? true),
      { threshold: 0.1 },
    );
    observer.observe(title);
    return () => observer.disconnect();
  }, [dinner.id]);

  const jumpTo = (target: "ingredients" | "steps") => {
    const element =
      target === "ingredients" ? ingredientsRef.current : stepsRef.current;
    element?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <article className="mx-auto w-full max-w-[640px] px-1 pb-2">
      <header className="space-y-3">
        {headerLabel && (
          <div className="flex items-center gap-3">
            <p className="text-muted-foreground min-w-0 flex-1 text-[13px] font-semibold">
              {headerLabel}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              {headerAction}
            </div>
          </div>
        )}
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            {historyLabel && (
              <p className="text-muted-foreground mb-0.5 text-[11.5px] font-semibold">
                {historyLabel}
              </p>
            )}
            <h1
              ref={titleRef}
              className="font-serif text-[26px] font-normal leading-[1.2]"
            >
              {dinner.name}
            </h1>
          </div>
          {!headerLabel && (
            <div className="flex shrink-0 items-center gap-2">
              {headerAction}
            </div>
          )}
        </div>

        {(dinner.favourite || dinner.tags.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {dinner.favourite && <FavouriteChip />}
            {dinner.tags.map((tag) => (
              <span
                key={tag.value}
                className="text-muted-foreground rounded-full border bg-white px-2.5 py-[3px] text-xs font-semibold"
              >
                {tag.value}
              </span>
            ))}
          </div>
        )}

        {(dinner.link !== null || dinner.servings !== null) && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {dinner.link && (
              <a
                href={dinner.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-[hsl(18_75%_45%)]"
              >
                {sourceLabel(dinner.link)}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            {dinner.link && dinner.servings && (
              <span className="text-[hsl(40_15%_78%)]">·</span>
            )}
            {dinner.servings && (
              <span className="text-muted-foreground font-medium">
                {dinner.servings} servings
              </span>
            )}
          </div>
        )}
      </header>

      {(hasIngredients || hasSteps) && (
        <div className="sticky top-0 z-10 h-0">
          <StickyHeaderCard
            as="nav"
            aria-label="Recipe sections"
            aria-hidden={titleVisible}
            className={cn(
              "flex items-center gap-2 transition duration-150",
              titleVisible
                ? "pointer-events-none -translate-y-full opacity-0"
                : "translate-y-0 opacity-100",
            )}
          >
            <span className="min-w-0 flex-1 truncate font-serif text-base">
              {dinner.name}
            </span>
            {hasIngredients && (
              <button
                type="button"
                tabIndex={titleVisible ? -1 : undefined}
                className="text-primary shrink-0 text-xs font-bold"
                onClick={() => jumpTo("ingredients")}
              >
                Ingredients
              </button>
            )}
            {hasSteps && (
              <button
                type="button"
                tabIndex={titleVisible ? -1 : undefined}
                className="text-primary shrink-0 text-xs font-bold"
                onClick={() => jumpTo("steps")}
              >
                Steps
              </button>
            )}
          </StickyHeaderCard>
        </div>
      )}

      {hasRecipe ? (
        <div className="mt-6">
          {dinner.parts.map((part, partIndex) => (
            <section
              key={part.id}
              className={
                partIndex > 0
                  ? "mt-[26px] border-t border-[hsl(40_15%_86%)] pt-5"
                  : undefined
              }
            >
              {part.name && (
                <h2 className="font-serif text-xl font-normal">{part.name}</h2>
              )}

              {part.ingredients.length > 0 && (
                // max-content sizes the amount column to the part's longest
                // amount; the column (and its gap) is dropped entirely when
                // no ingredient in the part has one.
                <div
                  ref={
                    partIndex === firstIngredientsPartIndex
                      ? ingredientsRef
                      : undefined
                  }
                  className={cn(
                    "grid scroll-mt-14 gap-y-1.5 text-[14px] leading-[1.45]",
                    hasAmounts(part)
                      ? "grid-cols-[max-content_1fr] gap-x-2.5"
                      : "grid-cols-1",
                    part.name ? "mt-2.5" : "mt-0",
                  )}
                >
                  {part.ingredients.map((ingredient) => {
                    const amount = [
                      ingredient.amount === null
                        ? ""
                        : formatAmount(ingredient.amount),
                      ingredient.unit ?? "",
                    ]
                      .filter(Boolean)
                      .join(" ");

                    return (
                      <Fragment key={ingredient.id}>
                        {hasAmounts(part) && (
                          <span className="font-bold">{amount}</span>
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
                      </Fragment>
                    );
                  })}
                </div>
              )}

              {part.steps.length > 0 && (
                <ol
                  ref={partIndex === firstStepsPartIndex ? stepsRef : undefined}
                  className="mt-4 scroll-mt-14 space-y-2"
                >
                  {part.steps.map((step, stepIndex) => (
                    <li
                      key={step.id}
                      className="grid grid-cols-[22px_1fr] gap-2 text-[14px] leading-[1.55]"
                    >
                      <span className="font-serif text-[hsl(18_75%_50%)]">
                        {stepIndex + 1}
                      </span>
                      <span className="font-medium">{step.text}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          ))}
        </div>
      ) : null}

      {dinner.notes &&
        (hasRecipe ? (
          <section className="mt-[26px] border-t border-[hsl(40_15%_86%)] pt-5">
            <h2 className="mb-1.5 font-serif text-base font-normal">Notes</h2>
            <p className="whitespace-pre-wrap text-[13.5px] font-medium leading-[1.6] text-[hsl(24_10%_25%)]">
              {dinner.notes}
            </p>
          </section>
        ) : (
          <p className="mt-7 whitespace-pre-wrap text-[13.5px] font-medium leading-[1.6] text-[hsl(24_10%_25%)]">
            {dinner.notes}
          </p>
        ))}

      {footerActions && (
        <footer className="sticky bottom-0 z-10 -mx-1 mt-8 grid grid-cols-2 gap-2 bg-white py-2">
          {footerActions}
        </footer>
      )}
    </article>
  );
};
