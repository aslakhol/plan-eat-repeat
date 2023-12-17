import { type Dinner } from "@prisma/client";
import { cn } from "../../lib/utils";
import { api } from "../../utils/api";
import { usePostHog } from "posthog-js/react";
import { startOfDay, addDays, isSameDay, format, startOfWeek } from "date-fns";
import { UtensilsCrossed } from "lucide-react";
import { useState } from "react";
import { WeekSelect } from "../WeekSelect";

type Props = { selectedDinner: Dinner; closeDialog: () => void };

export const DialogWeek = ({ selectedDinner, closeDialog }: Props) => {
  const [weekOfSet, setWeekOfSet] = useState(0);

  const startOfCurrentWeek = startOfWeek(new Date(), {
    weekStartsOn: 1,
  });
  const startOfDisplayedWeek = addDays(startOfCurrentWeek, weekOfSet * 7);

  const week: Date[] = [
    startOfDay(startOfDisplayedWeek),
    startOfDay(addDays(startOfDisplayedWeek, 1)),
    startOfDay(addDays(startOfDisplayedWeek, 2)),
    startOfDay(addDays(startOfDisplayedWeek, 3)),
    startOfDay(addDays(startOfDisplayedWeek, 4)),
    startOfDay(addDays(startOfDisplayedWeek, 5)),
    startOfDay(addDays(startOfDisplayedWeek, 6)),
  ];

  const plannedDinnersQuery = api.plan.plannedDinners.useQuery(
    {
      startOfWeek: startOfDisplayedWeek,
    },
    { keepPreviousData: true },
  );

  if (plannedDinnersQuery.isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <UtensilsCrossed className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 overflow-y-auto">
      <WeekSelect
        setWeekOfSet={setWeekOfSet}
        startOfDisplayedWeek={startOfDisplayedWeek}
      />
      {week.map((day) => (
        <Day
          key={day.toString()}
          date={day}
          selectedDinner={selectedDinner}
          plannedDinner={
            plannedDinnersQuery.data?.plans.find((p) => isSameDay(p.date, day))
              ?.dinner
          }
          closeDialog={closeDialog}
        />
      ))}
    </div>
  );
};

type DayProps = {
  date: Date;
  plannedDinner?: Dinner;
  selectedDinner: Dinner;
  closeDialog: () => void;
};

const Day = ({
  date,
  plannedDinner,
  selectedDinner,
  closeDialog,
}: DayProps) => {
  return (
    <div
      className={cn(
        "flex flex-col rounded border px-2 py-2",
        selectedDinner.id === plannedDinner?.id && "underline",
      )}
    >
      <h3 className="mb-2 mr-1 text-xs">{format(date, "EEE do")}</h3>
      <Slot
        date={date}
        plannedDinner={plannedDinner}
        selectedDinner={selectedDinner}
        closeDialog={closeDialog}
      />
    </div>
  );
};

type SlotProps = {
  date: Date;
  plannedDinner?: Dinner;
  selectedDinner: Dinner;
  closeDialog: () => void;
};

const Slot = ({
  date,
  plannedDinner,
  selectedDinner,
  closeDialog,
}: SlotProps) => {
  if (!plannedDinner) {
    return (
      <NoDinnerPlanned
        date={date}
        selectedDinner={selectedDinner}
        closeDialog={closeDialog}
      />
    );
  }

  return (
    <DinnerPlanned
      date={date}
      plannedDinner={plannedDinner}
      selectedDinner={selectedDinner}
      onClose={closeDialog}
    />
  );
};

type NoDinnerPlannedProps = {
  date: Date;
  selectedDinner: Dinner;
  closeDialog: () => void;
};

const NoDinnerPlanned = ({ date, selectedDinner }: NoDinnerPlannedProps) => {
  const posthog = usePostHog();
  const utils = api.useUtils();
  const planDinnerForDayMutation = api.plan.planDinnerForDate.useMutation({
    onMutate: (input) => {
      void utils.plan.plannedDinners.cancel();

      const prevPlannedDinners = utils.plan.plannedDinners.getData();

      utils.plan.plannedDinners.setData(undefined, (old) => {
        const oldPlans = old?.plans ?? [];

        return {
          plans: [
            ...oldPlans,
            {
              date: input.date,
              dinner: selectedDinner,
              dinnerId: selectedDinner.id,
              id: Math.ceil(Math.random() * -10000),
            },
          ],
        };
      });

      return { prevPlannedDinners };
    },
    onError: (_, __, context) => {
      if (context?.prevPlannedDinners) {
        utils.plan.plannedDinners.setData(
          undefined,
          context.prevPlannedDinners,
        );
      }
    },
    onSettled: () => {
      void utils.plan.plannedDinners.invalidate();
    },
    onSuccess: () => {
      posthog.capture("plan dinner from dinners page on empty day", {
        dinner: selectedDinner.name,
        date: format(date, "EEE do"),
      });
    },
  });

  const clickEmptyDay = () => {
    planDinnerForDayMutation.mutate({
      dinnerId: selectedDinner.id,
      secret: localStorage.getItem("sulten-secret"),
      date,
    });
  };

  return (
    <div
      className="h-12 rounded-md hover:bg-accent"
      onClick={clickEmptyDay}
    ></div>
  );
};

type DinnerPlannedProps = {
  date: Date;
  plannedDinner: Dinner;
  selectedDinner: Dinner;
  onClose: () => void;
};

const DinnerPlanned = ({
  date,
  plannedDinner,
  selectedDinner,
}: DinnerPlannedProps) => {
  const posthog = usePostHog();
  const utils = api.useUtils();

  const unplanDayMutation = api.plan.unplanDay.useMutation({
    onMutate: (input) => {
      void utils.plan.plannedDinners.cancel();

      const prevPlannedDinners = utils.plan.plannedDinners.getData();

      utils.plan.plannedDinners.setData(undefined, (old) => {
        const oldPlans = old?.plans ?? [];

        return {
          plans: oldPlans.filter(
            (oldPlan) => !isSameDay(oldPlan.date, input.date),
          ),
        };
      });

      return { prevPlannedDinners };
    },
    onError: (_, __, context) => {
      if (context?.prevPlannedDinners) {
        utils.plan.plannedDinners.setData(
          undefined,
          context.prevPlannedDinners,
        );
      }
    },
    onSettled: () => {
      void utils.plan.plannedDinners.invalidate();
    },
    onSuccess: () => {
      posthog.capture("remove plan", {
        dinner: selectedDinner.name,
        day: format(date, "EEE do"),
      });
    },
  });

  const planDinnerForDateMutation = api.plan.planDinnerForDate.useMutation({
    onMutate: (input) => {
      void utils.plan.plannedDinners.cancel();

      const prevPlannedDinners = utils.plan.plannedDinners.getData();

      utils.plan.plannedDinners.setData(undefined, (old) => {
        const oldPlan = old?.plans ?? [];

        return {
          plans: oldPlan.map((plan) => {
            if (isSameDay(plan.date, input.date)) {
              return {
                ...plan,
                dinnerId: input.dinnerId,
                dinner: selectedDinner,
              };
            }

            return plan;
          }),
        };
      });
      return { prevPlannedDinners };
    },
    onError: (_, __, context) => {
      if (context?.prevPlannedDinners) {
        utils.plan.plannedDinners.setData(
          undefined,
          context.prevPlannedDinners,
        );
      }
    },
    onSettled: () => {
      void utils.plan.plannedDinners.invalidate();
    },
    onSuccess: () => {
      posthog.capture("replace dinner with new dinner", {
        newDinner: selectedDinner.name,
        oldDinner: plannedDinner.name,
        day: format(date, "EEE do"),
      });
    },
  });

  const click = () => {
    if (selectedDinner.id === plannedDinner.id) {
      return unplanDayMutation.mutate({
        date: date,
        secret: localStorage.getItem("sulten-secret"),
      });
    }

    planDinnerForDateMutation.mutate({
      dinnerId: selectedDinner.id,
      secret: localStorage.getItem("sulten-secret"),
      date,
    });
  };

  return (
    <div
      className={cn(
        "flex h-12 flex-col-reverse rounded-md p-1 hover:bg-slate-100",
      )}
      onClick={click}
    >
      <p className={cn("font-semibold")}>{plannedDinner.name}</p>
    </div>
  );
};
