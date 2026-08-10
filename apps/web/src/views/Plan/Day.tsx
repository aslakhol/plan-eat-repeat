import { format, isSameDay } from "date-fns";
import { cn } from "../../lib/utils";
import { PlannedDinner } from "./PlannedDinner";
import { type DinnerWithRecipe } from "../../utils/types";
import { useState } from "react";
import { PlanDay } from "./PlanDay";
import {
  ResponsiveModal,
  ResponsiveModalTrigger,
} from "../../components/ResponsiveModal";
import { formatWeekOverviewDayLabel } from "~/lib/dinner-planning";
import { Button } from "~/components/ui/button";

type Props = {
  date: Date;
  today: Date;
  plannedDinner?: DinnerWithRecipe;
};

export const Day = ({ date, today, plannedDinner }: Props) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [changePlan, setChangePlan] = useState(!plannedDinner);

  const onOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setChangePlan(false);
    }
  };

  const isDateToday = isSameDay(date, today);

  return (
    <ResponsiveModal open={dialogOpen} onOpenChange={onOpenChange}>
      <ResponsiveModalTrigger asChild>
        <Button
          type="button"
          variant="outline"
          data-testid="plan-day-trigger"
          data-date={format(date, "yyyy-MM-dd")}
          className={cn(
            "group relative flex h-auto min-h-[80px] w-full flex-col items-stretch justify-center gap-0 overflow-hidden whitespace-normal rounded-[14px] border-[1.5px] px-4 py-3 text-left sm:min-h-[140px]",
            !plannedDinner &&
              "border-border hover:border-primary/50 border-dashed bg-transparent",
            plannedDinner &&
              "bg-muted hover:bg-accent border-transparent shadow-none",
            isDateToday &&
              "border-primary focus-visible:ring-primary border-solid bg-white hover:bg-white",
          )}
        >
          <span
            className={cn(
              "text-muted-foreground text-[11px] font-bold",
              isDateToday && "text-primary",
            )}
          >
            {formatWeekOverviewDayLabel(date, today)}
          </span>
          {plannedDinner ? (
            <span className="mt-1 line-clamp-2 font-serif text-xl font-normal leading-tight">
              {plannedDinner.name}
            </span>
          ) : (
            <span
              aria-hidden="true"
              className="text-muted-foreground group-hover:text-primary absolute right-4 text-[24px] font-light leading-none transition-colors"
            >
              +
            </span>
          )}
        </Button>
      </ResponsiveModalTrigger>
      <>
        {changePlan || !plannedDinner ? (
          <PlanDay
            date={date}
            closeDialog={() => onOpenChange(false)}
            plannedDinner={plannedDinner}
          />
        ) : (
          <PlannedDinner
            dinner={plannedDinner}
            date={date}
            closeDialog={() => onOpenChange(false)}
            setChangePlan={setChangePlan}
            isOpen={dialogOpen}
          />
        )}
      </>
    </ResponsiveModal>
  );
};
