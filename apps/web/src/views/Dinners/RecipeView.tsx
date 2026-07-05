import { Fragment } from "react";
import { ExternalLink } from "lucide-react";
import { formatAmount, type DinnerWithRecipe } from "@planeatrepeat/shared";
import { Button } from "../../components/ui/button";

type Props = {
  dinner: DinnerWithRecipe;
  onEdit: () => void;
};

const sourceLabel = (link: string) => {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return link;
  }
};

export const RecipeView = ({ dinner, onEdit }: Props) => {
  const hasRecipe = dinner.parts.length > 0;

  return (
    <article className="mx-auto w-full max-w-[640px] px-1 pb-6">
      <header className="space-y-3">
        <div className="flex items-start gap-3">
          <h1 className="min-w-0 flex-1 font-serif text-[26px] font-normal leading-[1.2]">
            {dinner.name}
          </h1>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-muted-foreground h-auto bg-white px-3 py-1.5 text-[13px] font-semibold"
            onClick={onEdit}
          >
            Edit
          </Button>
        </div>

        {dinner.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
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
                // amount, and collapses it when no ingredient has one.
                <div
                  className={`grid grid-cols-[max-content_1fr] gap-x-2.5 gap-y-1 text-base leading-[1.3] ${
                    part.name ? "mt-2.5" : "mt-0"
                  }`}
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
                        <span className="font-bold">{amount}</span>
                        <span className="font-medium">
                          {ingredient.name}
                          {ingredient.note && (
                            <span className="text-muted-foreground font-normal">
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
                <ol className="mt-3 space-y-[5px]">
                  {part.steps.map((step, stepIndex) => (
                    <li
                      key={step.id}
                      className="grid grid-cols-[22px_1fr] gap-2 text-base leading-[1.35]"
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
      ) : (
        <div className="mt-8">
          <Button type="button" onClick={onEdit}>
            Add recipe
          </Button>
        </div>
      )}

      {dinner.notes && (
        <section className="mt-[26px] border-t border-[hsl(40_15%_86%)] pt-5">
          <h2 className="mb-1.5 font-serif text-base font-normal">Notes</h2>
          <p className="whitespace-pre-wrap text-[15px] font-medium leading-[1.5] text-[hsl(24_10%_25%)]">
            {dinner.notes}
          </p>
        </section>
      )}
    </article>
  );
};
