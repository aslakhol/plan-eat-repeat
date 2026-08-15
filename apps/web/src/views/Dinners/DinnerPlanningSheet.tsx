import { addWeeks, isSameDay } from "date-fns";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalTitle,
} from "~/components/ResponsiveModal";
import { Button } from "~/components/ui/button";
import { toast } from "~/components/ui/use-toast";
import {
  buildDinnerPlanningWeek,
  formatDinnerPlanningConfirmation,
} from "~/lib/dinner-planning";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";

type DinnerPlanningSheetProps = {
  dinner: {
    id: number;
    name: string;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPlanned: () => void;
  today: Date;
};

export const DinnerPlanningSheet = ({
  dinner,
  open,
  onOpenChange,
  onPlanned,
  today,
}: DinnerPlanningSheetProps) => {
  const utils = api.useUtils();
  const [targetWeek, setTargetWeek] = useState(
    () => buildDinnerPlanningWeek(today).start,
  );
  const [pendingReplaceDate, setPendingReplaceDate] = useState<Date | null>(
    null,
  );
  const week = useMemo(() => buildDinnerPlanningWeek(targetWeek), [targetWeek]);

  useEffect(() => {
    if (!open) return;
    setTargetWeek(buildDinnerPlanningWeek(today).start);
    setPendingReplaceDate(null);
  }, [open, today]);

  const plansQuery = api.plan.plannedDinners.useQuery(
    { startOfWeek: week.start },
    { enabled: open },
  );

  const planMutation = api.plan.planDinnerForDate.useMutation({
    onSuccess: async (_result, variables) => {
      await Promise.all([
        utils.plan.plannedDinners.invalidate(),
        utils.dinner.summaries.invalidate(),
      ]);
      toast({
        title: formatDinnerPlanningConfirmation(dinner.name, variables.date),
      });
      onPlanned();
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Could not plan Dinner",
        description: error.message,
      });
    },
  });

  const planForDate = (date: Date) => {
    planMutation.mutate({ dinnerId: dinner.id, date });
  };

  const changeWeek = (offset: number) => {
    setPendingReplaceDate(null);
    setTargetWeek((currentWeek) => addWeeks(currentWeek, offset));
  };

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && planMutation.isPending) return;
        if (!nextOpen) setPendingReplaceDate(null);
        onOpenChange(nextOpen);
      }}
    >
      <ResponsiveModalContent
        scrollViewport
        scrollViewportClassName="grid gap-4"
        className="h-auto max-h-[92dvh] bg-white px-4 pb-5 md:max-w-[520px]"
      >
        <ResponsiveModalTitle className="text-muted-foreground text-center text-[13px] font-semibold">
          Plan <span className="text-foreground font-serif">{dinner.name}</span>{" "}
          for…
        </ResponsiveModalTitle>
        <ResponsiveModalDescription className="sr-only">
          Choose a date in the selected ISO week. A date that already has a
          Dinner can be kept or replaced.
        </ResponsiveModalDescription>

        <div className="flex items-center justify-center gap-5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9 rounded-full bg-white"
            disabled={planMutation.isPending}
            onClick={() => changeWeek(-1)}
          >
            <ChevronLeft />
            <span className="sr-only">Previous week</span>
          </Button>
          <p className="min-w-44 text-center text-sm font-bold">{week.label}</p>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9 rounded-full bg-white"
            disabled={planMutation.isPending}
            onClick={() => changeWeek(1)}
          >
            <ChevronRight />
            <span className="sr-only">Next week</span>
          </Button>
        </div>

        {plansQuery.isPending ? (
          <div className="text-muted-foreground flex min-h-56 items-center justify-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Loading week…
          </div>
        ) : plansQuery.isError ? (
          <div className="flex min-h-56 flex-col items-center justify-center gap-3 text-center">
            <p className="text-destructive text-sm font-semibold">
              Couldn&apos;t load this week.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => void plansQuery.refetch()}
            >
              Try again
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2" aria-label={week.label}>
            {week.days.map((day) => {
              const plan = plansQuery.data.plans.find((candidate) =>
                isSameDay(candidate.date, day.date),
              );
              const isToday = isSameDay(day.date, today);
              const isExpanded =
                plan !== undefined &&
                pendingReplaceDate !== null &&
                isSameDay(day.date, pendingReplaceDate);

              if (!plan) {
                return (
                  <button
                    key={day.dateTime}
                    type="button"
                    className={cn(
                      "border-border hover:bg-muted/50 flex min-h-14 w-full items-center rounded-xl border-[1.5px] border-dashed px-3.5 py-2.5 text-left transition-colors disabled:cursor-wait disabled:opacity-50",
                      isToday && "border-primary border-solid",
                    )}
                    aria-label={`Plan ${dinner.name} for ${day.fullDate}`}
                    disabled={planMutation.isPending}
                    onClick={() => planForDate(day.date)}
                  >
                    <time
                      dateTime={day.dateTime}
                      className={cn(
                        "w-[7.25rem] shrink-0 text-xs font-bold",
                        isToday && "text-primary",
                      )}
                    >
                      {day.dayLabel}
                      {isToday ? " · Tonight" : ""}
                    </time>
                    <span className="text-muted-foreground text-xs font-semibold">
                      free
                    </span>
                  </button>
                );
              }

              if (isExpanded) {
                return (
                  <div
                    key={day.dateTime}
                    className="border-primary bg-primary/15 rounded-xl border px-3.5 py-3"
                  >
                    <p className="text-destructive flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold">
                      <time dateTime={day.dateTime} className="font-bold">
                        {day.dayLabel}
                        {isToday ? " · Tonight" : ""}
                      </time>
                      <span>already has {plan.dinner.name}</span>
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="bg-white"
                        disabled={planMutation.isPending}
                        onClick={() => setPendingReplaceDate(null)}
                      >
                        Keep it
                      </Button>
                      <Button
                        type="button"
                        disabled={planMutation.isPending}
                        onClick={() => planForDate(day.date)}
                      >
                        {planMutation.isPending ? (
                          <Loader2 className="animate-spin" />
                        ) : null}
                        Replace
                      </Button>
                    </div>
                  </div>
                );
              }

              return (
                <button
                  key={day.dateTime}
                  type="button"
                  className={cn(
                    "border-border hover:bg-muted/50 flex min-h-14 w-full items-center rounded-xl border px-3.5 py-2.5 text-left transition-colors disabled:opacity-50",
                    isToday && "border-primary",
                  )}
                  aria-label={`${day.fullDate} already has ${plan.dinner.name}`}
                  disabled={planMutation.isPending}
                  onClick={() => setPendingReplaceDate(day.date)}
                >
                  <time
                    dateTime={day.dateTime}
                    className={cn(
                      "w-[7.25rem] shrink-0 text-xs font-bold",
                      isToday && "text-primary",
                    )}
                  >
                    {day.dayLabel}
                    {isToday ? " · Tonight" : ""}
                  </time>
                  <span className="text-muted-foreground truncate font-serif text-sm">
                    {plan.dinner.name}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
};
