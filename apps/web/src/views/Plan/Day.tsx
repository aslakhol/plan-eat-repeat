import { format, isSameDay } from "date-fns";
import { ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";
import { PlannedDinner } from "./PlannedDinner";
import { type DinnerWithRecipe } from "../../utils/types";
import { useEffect, useState } from "react";
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
  openOnLoad?: boolean;
  onCloseRequestedDate?: () => void;
};

export const Day = ({
  date,
  today,
  plannedDinner,
  openOnLoad = false,
  onCloseRequestedDate,
}: Props) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [changePlan, setChangePlan] = useState(!plannedDinner);

  useEffect(() => {
    if (openOnLoad) {
      setDialogOpen(true);
      setChangePlan(!plannedDinner);
    }
  }, [openOnLoad, plannedDinner]);

  const onOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setChangePlan(false);
      if (openOnLoad) onCloseRequestedDate?.();
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
            "group relative flex h-auto min-h-[80px] w-full flex-col items-stretch justify-center gap-0 overflow-hidden whitespace-normal rounded-[14px] border-[1.5px] px-4 py-3 text-left md:grid md:grid-cols-[112px_minmax(0,1fr)_24px] md:items-center md:gap-5 md:px-5",
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
              "text-muted-foreground text-[11px] font-bold md:border-r md:pr-4",
              isDateToday && "text-primary",
            )}
          >
            <span className="md:hidden">
              {formatWeekOverviewDayLabel(date, today)}
            </span>
            <span className="hidden md:flex md:flex-col md:gap-1">
              <span className="text-[13px]">{format(date, "EEEE")}</span>
              <span className="text-[11px] font-medium">
                {format(date, "d MMM")}
                {isDateToday && " · Tonight"}
              </span>
            </span>
          </span>
          {plannedDinner ? (
            <span className="mt-1 line-clamp-2 font-serif text-xl font-normal leading-tight md:mt-0">
              {plannedDinner.name}
            </span>
          ) : (
            <span
              aria-hidden="true"
              className="text-muted-foreground group-hover:text-primary absolute right-4 text-[24px] font-light leading-none transition-colors md:static md:col-start-3 md:text-center"
            >
              +
            </span>
          )}
          {plannedDinner && (
            <ChevronRight
              aria-hidden="true"
              className="text-muted-foreground/60 group-hover:text-primary hidden justify-self-center md:block"
            />
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
