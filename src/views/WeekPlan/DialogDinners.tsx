import { type Dinner } from "@prisma/client";
import { cn } from "../../lib/utils";
import { api } from "../../utils/api";
import { usePostHog } from "posthog-js/react";
import { format } from "date-fns";

type Props = { date: Date };

export const DialogDinners = ({ date }: Props) => {
  const dinnersQuery = api.dinner.dinners.useQuery();

  return (
    <div className={cn("flex max-h-[80vh] flex-col gap-2 overflow-y-auto")}>
      {dinnersQuery.data?.dinners.map((dinner) => (
        <DialogDinner key={dinner.id} date={date} dinner={dinner} />
      ))}
    </div>
  );
};

type DialogDinnerProps = { date: Date; dinner: Dinner };

const DialogDinner = ({ date, dinner }: DialogDinnerProps) => {
  const posthog = usePostHog();
  const utils = api.useUtils();
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
      void utils.plan.plannedDinners.invalidate();
    },
  });

  const handleClick = () => {
    posthog.capture("plan dinner from week page", {
      dinner: dinner.name,
      day: format(date, "EEE do"),
    });

    return planDinnerForDateMutation.mutate({
      date,
      dinnerId: dinner.id,
      secret: localStorage.getItem("sulten-secret"),
    });
  };

  return (
    <div
      className={cn(
        "flex cursor-pointer flex-col rounded border px-4 py-2 hover:bg-accent/50 hover:text-accent-foreground",
        // dinnerIsPlanned && "ring-2",
      )}
      onClick={handleClick}
    >
      <h3 className="font-semibold">{dinner.name}</h3>
    </div>
  );
};
