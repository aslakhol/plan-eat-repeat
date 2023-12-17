import { type Dinner } from "@prisma/client";
import { cn } from "../../lib/utils";
import { api } from "../../utils/api";
import { usePostHog } from "posthog-js/react";
import { startOfDay, addDays, isSameDay, format } from "date-fns";
import { UtensilsCrossed } from "lucide-react";

type Props = { selectedDinner: Dinner };

export const DialogWeek = ({ selectedDinner }: Props) => {
  const plannedDinnersQuery = api.plan.plannedDinners.useQuery();

  const week: Date[] = [
    startOfDay(new Date()),
    startOfDay(addDays(new Date(), 1)),
    startOfDay(addDays(new Date(), 2)),
    startOfDay(addDays(new Date(), 3)),
    startOfDay(addDays(new Date(), 4)),
    startOfDay(addDays(new Date(), 5)),
    startOfDay(addDays(new Date(), 6)),
  ];

  if (plannedDinnersQuery.isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <UtensilsCrossed className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 overflow-y-auto">
      {week.map((day) => (
        <Day
          key={day.toString()}
          date={day}
          selectedDinner={selectedDinner}
          plannedDinner={
            plannedDinnersQuery.data?.plans.find((p) => isSameDay(p.date, day))
              ?.dinner
          }
        />
      ))}
    </div>
  );
};

type DayProps = {
  date: Date;
  plannedDinner?: Dinner;
  selectedDinner: Dinner;
};

const Day = ({ date, plannedDinner, selectedDinner }: DayProps) => {
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
      />
    </div>
  );
};

type SlotProps = {
  date: Date;
  plannedDinner?: Dinner;
  selectedDinner: Dinner;
};

const Slot = ({ date, plannedDinner, selectedDinner }: SlotProps) => {
  if (!plannedDinner) {
    return <NoDinnerPlanned date={date} selectedDinner={selectedDinner} />;
  }

  return (
    <DinnerPlanned
      date={date}
      plannedDinner={plannedDinner}
      selectedDinner={selectedDinner}
    />
  );
};

type NoDinnerPlannedProps = {
  date: Date;
  selectedDinner: Dinner;
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
  });

  const clickEmptyDay = () => {
    posthog.capture("plan dinner from dinners page on empty day", {
      dinner: selectedDinner.name,
      date: format(date, "EEE do"),
    });

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
};

const DinnerPlanned = ({
  date,
  plannedDinner,
  selectedDinner,
}: DinnerPlannedProps) => {
  const posthog = usePostHog();
  const utils = api.useUtils();

  const unplanDayMutation = api.plan.unplanDay.useMutation();

  const planDinnerForDateMutation = api.plan.planDinnerForDate.useMutation({
    // onMutate: (input) => {
    //   void utils.dinner.dinners.cancel();

    //   const prevDinners = utils.dinner.dinners.getData();

    //   utils.dinner.dinners.setData(undefined, (old) => {
    //     return {
    //       dinners:
    //         old?.dinners.map((dinner) => {
    //           if (dinner.plannedForDay === input.day) {
    //             return {
    //               ...dinner,
    //               plannedForDay: null,
    //             };
    //           }

    //           if (dinner.id === input.dinnerId) {
    //             return {
    //               ...dinner,
    //               plannedForDay: input.day,
    //             };
    //           }

    //           return dinner;
    //         }) ?? [],
    //     };
    //   });

    //   return { prevDinners };
    // },
    // onError: (_, __, context) => {
    //   if (context?.prevDinners) {
    //     utils.dinner.dinners.setData(undefined, context.prevDinners);
    //   }
    // },
    onSettled: () => {
      void utils.dinner.dinners.invalidate();
    },
  });

  const click = () => {
    if (selectedDinner.id === plannedDinner.id) {
      posthog.capture("remove plan", {
        dinner: selectedDinner.name,
        day: format(date, "EEE do"),
      });

      return unplanDayMutation.mutate({
        date: date,
        secret: localStorage.getItem("sulten-secret"),
      });
    }

    posthog.capture("replace dinner with new dinner", {
      newDinner: selectedDinner.name,
      oldDinner: plannedDinner.name,
      day: format(date, "EEE do"),
    });
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
