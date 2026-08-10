import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";
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

type TagLineProps = {
  tags: DinnerSummary["tags"];
  selectedTags: readonly string[];
};

const tagClassName = (selected: boolean) =>
  cn(
    "text-muted-foreground shrink-0 bg-white py-[3px] text-[10.5px] font-semibold leading-none",
    selected && "border-primary bg-primary/10 text-primary",
  );

const TagLine = ({ tags, selectedTags }: TagLineProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(tags.length);

  useEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const measuredTags = Array.from(
      measure.querySelectorAll<HTMLElement>("[data-measure-tag]"),
    );
    const measuredMarker = measure.querySelector<HTMLElement>(
      "[data-measure-marker]",
    );
    if (!measuredMarker) return;

    const updateVisibleCount = () => {
      const availableWidth = container.clientWidth;
      const gap = Number.parseFloat(getComputedStyle(measure).columnGap) || 0;
      let occupiedWidth = 0;
      let nextVisibleCount = 0;

      for (let count = 0; count <= tags.length; count += 1) {
        if (count > 0) {
          occupiedWidth +=
            (count > 1 ? gap : 0) +
            (measuredTags[count - 1]?.getBoundingClientRect().width ?? 0);
        }

        const hiddenCount = tags.length - count;
        measuredMarker.textContent = `+${hiddenCount}`;
        const requiredWidth =
          occupiedWidth +
          (hiddenCount > 0
            ? (count > 0 ? gap : 0) +
              measuredMarker.getBoundingClientRect().width
            : 0);

        if (requiredWidth <= availableWidth) nextVisibleCount = count;
      }

      setVisibleCount(nextVisibleCount);
    };

    updateVisibleCount();
    const observer = new ResizeObserver(updateVisibleCount);
    observer.observe(container);
    return () => observer.disconnect();
  }, [tags]);

  const hiddenCount = tags.length - visibleCount;

  return (
    <div
      ref={containerRef}
      className="relative mt-2 flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap"
    >
      {tags.slice(0, visibleCount).map((tag) => (
        <Badge
          key={tag.value}
          variant="outline"
          className={tagClassName(selectedTags.includes(tag.value))}
        >
          {tag.value}
        </Badge>
      ))}
      {hiddenCount > 0 && (
        <span className="text-muted-foreground shrink-0 text-[11px] font-semibold">
          +{hiddenCount}
        </span>
      )}

      <div
        ref={measureRef}
        aria-hidden="true"
        className="invisible absolute left-0 top-0 flex w-max items-center gap-1.5"
      >
        {tags.map((tag) => (
          <Badge
            key={tag.value}
            data-measure-tag
            variant="outline"
            className={tagClassName(selectedTags.includes(tag.value))}
          >
            {tag.value}
          </Badge>
        ))}
        <span
          data-measure-marker
          className="text-muted-foreground shrink-0 text-[11px] font-semibold"
        >
          +{tags.length}
        </span>
      </div>
    </div>
  );
};

export const DinnerList = ({ dinners, selectedTags, today }: Props) => {
  return (
    <div className="flex flex-col gap-2.5">
      {dinners.map((dinner) => {
        const hasCurrentWeekPlan = dinner.currentWeekPlanDates.length > 0;

        return (
          <Link
            key={dinner.id}
            href={`/dinners/${dinner.id}`}
            className="group block min-w-0"
          >
            <Card className="bg-secondary/70 group-hover:bg-secondary min-w-0 border-0 px-3.5 py-3 shadow-none transition-colors">
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
                <TagLine tags={dinner.tags} selectedTags={selectedTags} />
              )}
            </Card>
          </Link>
        );
      })}
    </div>
  );
};
