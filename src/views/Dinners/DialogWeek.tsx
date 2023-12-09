import { type Dinner } from "@prisma/client";
import { cn } from "../../lib/utils";
import { api } from "../../utils/api";
import { getWeekPlan } from "../../utils/dinner";
import { usePostHog } from "posthog-js/react";

type Props = { selectedDinner: Dinner };

export const DialogWeek = ({ selectedDinner }: Props) => {
  const dinnersQuery = api.dinner.dinners.useQuery();

  const weekPlan = getWeekPlan(dinnersQuery.data?.dinners);

  const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  return (
    <div className="flex w-full flex-col gap-2 overflow-y-auto">
      {days.map((day, index) => (
        <Day
          key={day}
          day={day}
          dayNumber={index}
          plannedDinner={weekPlan[index]}
          selectedDinner={selectedDinner}
        />
      ))}
    </div>
  );
};

type DayProps = {
  day: string;
  dayNumber: number;
  plannedDinner?: Dinner;
  selectedDinner: Dinner;
};

const Day = ({ day, dayNumber, plannedDinner, selectedDinner }: DayProps) => {
  return (
    <div
      className={cn(
        "flex flex-col rounded border px-2 py-2",
        selectedDinner.id === plannedDinner?.id && "underline",
      )}
    >
      <h3 className="mb-2 mr-1 text-xs">{day}</h3>
      <Slot
        dayNumber={dayNumber}
        day={day}
        plannedDinner={plannedDinner}
        selectedDinner={selectedDinner}
      />
    </div>
  );
};

type SlotProps = {
  day: string;
  dayNumber: number;
  plannedDinner?: Dinner;
  selectedDinner: Dinner;
};

const Slot = ({ day, dayNumber, plannedDinner, selectedDinner }: SlotProps) => {
  if (!plannedDinner) {
    return (
      <NoDinnerPlanned
        day={day}
        dayNumber={dayNumber}
        selectedDinner={selectedDinner}
      />
    );
  }

  return (
    <DinnerPlanned
      day={day}
      dayNumber={dayNumber}
      plannedDinner={plannedDinner}
      selectedDinner={selectedDinner}
    />
  );
};

type NoDinnerPlannedProps = {
  day: string;
  dayNumber: number;
  selectedDinner: Dinner;
};

const NoDinnerPlanned = ({
  dayNumber,
  selectedDinner,
}: NoDinnerPlannedProps) => {
  const posthog = usePostHog();
  const utils = api.useUtils();
  const planDinnerForDayMutation = api.plan.planDinnerForDay.useMutation({
    onMutate: (input) => {
      void utils.dinner.dinners.cancel();

      const prevDinners = utils.dinner.dinners.getData();

      utils.dinner.dinners.setData(undefined, (old) => {
        return {
          dinners:
            old?.dinners.map((dinner) =>
              dinner.id === input.dinnerId
                ? {
                    ...dinner,
                    plannedForDay: input.day,
                  }
                : dinner,
            ) ?? [],
        };
      });

      return { prevDinners };
    },
    onError: (_, __, context) => {
      if (context?.prevDinners) {
        utils.dinner.dinners.setData(undefined, context.prevDinners);
      }
    },
    onSettled: () => {
      void utils.dinner.dinners.invalidate();
    },
  });

  const clickEmptyDay = () => {
    posthog.capture("plan dinner from dinners page on empty day", {
      dinner: selectedDinner.name,
      day: dayNumber,
    });

    planDinnerForDayMutation.mutate({
      dinnerId: selectedDinner.id,
      secret: localStorage.getItem("sulten-secret"),
      day: dayNumber,
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
  day: string;
  dayNumber: number;
  plannedDinner: Dinner;
  selectedDinner: Dinner;
};

const DinnerPlanned = ({
  day,
  dayNumber,
  plannedDinner,
  selectedDinner,
}: DinnerPlannedProps) => {
  const posthog = usePostHog();
  const utils = api.useUtils();
  const unplanDinnerMutation = api.plan.unplanDinner.useMutation({
    onMutate: (input) => {
      void utils.dinner.dinners.cancel();

      const prevDinners = utils.dinner.dinners.getData();

      utils.dinner.dinners.setData(undefined, (old) => {
        return {
          dinners:
            old?.dinners.map((dinner) =>
              dinner.id === input.dinnerId
                ? {
                    ...dinner,
                    plannedForDay: null,
                  }
                : dinner,
            ) ?? [],
        };
      });

      return { prevDinners };
    },
    onError: (_, __, context) => {
      if (context?.prevDinners) {
        utils.dinner.dinners.setData(undefined, context.prevDinners);
      }
    },
    onSettled: () => {
      void utils.dinner.dinners.invalidate();
    },
  });

  const replacePlannedMutation = api.plan.planDinnerForDay.useMutation({
    onMutate: (input) => {
      void utils.dinner.dinners.cancel();

      const prevDinners = utils.dinner.dinners.getData();

      utils.dinner.dinners.setData(undefined, (old) => {
        return {
          dinners:
            old?.dinners.map((dinner) => {
              if (dinner.plannedForDay === input.day) {
                return {
                  ...dinner,
                  plannedForDay: null,
                };
              }

              if (dinner.id === input.dinnerId) {
                return {
                  ...dinner,
                  plannedForDay: input.day,
                };
              }

              return dinner;
            }) ?? [],
        };
      });

      return { prevDinners };
    },
    onError: (_, __, context) => {
      if (context?.prevDinners) {
        utils.dinner.dinners.setData(undefined, context.prevDinners);
      }
    },
    onSettled: () => {
      void utils.dinner.dinners.invalidate();
    },
  });

  const click = () => {
    if (selectedDinner.id === plannedDinner.id) {
      posthog.capture("remove planned dinner", {
        dinner: selectedDinner.name,
        day,
      });

      return unplanDinnerMutation.mutate({
        dinnerId: selectedDinner.id,
        secret: localStorage.getItem("sulten-secret"),
      });
    }

    posthog.capture("replace dinner with new dinner", {
      newDinner: selectedDinner.name,
      oldDinner: plannedDinner.name,
      day,
    });
    replacePlannedMutation.mutate({
      dinnerId: selectedDinner.id,
      secret: localStorage.getItem("sulten-secret"),
      day: dayNumber,
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
