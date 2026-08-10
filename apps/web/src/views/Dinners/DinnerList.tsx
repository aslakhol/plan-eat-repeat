import Link from "next/link";

import { cn } from "~/lib/utils";
import { formatDinnerSummaryLabel } from "~/lib/cookbook";
import { type RouterOutputs } from "~/utils/api";

type DinnerSummary =
  RouterOutputs["dinner"]["summaries"]["dinners"][number];

type Props = {
  dinners: DinnerSummary[];
  selectedTags: string[];
  today: Date;
};

const MAX_VISIBLE_TAGS = 3;

export const DinnerList = ({ dinners, selectedTags, today }: Props) => {
  return (
    <div className="flex flex-col gap-2.5">
      {dinners.map((dinner) => {
        const visibleTags = dinner.tags.slice(0, MAX_VISIBLE_TAGS);
        const hiddenTagCount = dinner.tags.length - visibleTags.length;
        const hasCurrentWeekPlan = dinner.currentWeekPlanDates.length > 0;

        return (
          <Link
            key={dinner.id}
            href={`/dinners/${dinner.id}`}
            className="bg-secondary/70 hover:bg-secondary block min-w-0 rounded-lg px-3.5 py-3 transition-colors"
          >
            <div className="flex min-w-0 items-baseline gap-3">
              <span className="min-w-0 flex-1 truncate font-serif text-[15px] leading-tight">
                {dinner.name}
              </span>
              <span
                className={cn(
                  "text-muted-foreground shrink-0 text-[11px] font-semibold",
                  hasCurrentWeekPlan && "text-primary",
                )}
              >
                {formatDinnerSummaryLabel({
                  today,
                  lastCookedDate: dinner.lastCookedDate,
                  currentWeekPlanDates: dinner.currentWeekPlanDates,
                })}
              </span>
            </div>

            {dinner.tags.length > 0 && (
              <div className="mt-2 flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap">
                {visibleTags.map((tag) => (
                  <span
                    key={tag.value}
                    className={cn(
                      "text-muted-foreground shrink-0 rounded-full border bg-white px-2.5 py-[3px] text-[10.5px] font-semibold leading-none",
                      selectedTags.includes(tag.value) &&
                        "border-primary bg-primary/10 text-primary",
                    )}
                  >
                    {tag.value}
                  </span>
                ))}
                {hiddenTagCount > 0 && (
                  <span className="text-muted-foreground shrink-0 text-[11px] font-semibold">
                    +{hiddenTagCount}
                  </span>
                )}
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
};
