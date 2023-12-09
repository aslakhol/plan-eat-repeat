import { type Dinner } from "@prisma/client";
import { cn } from "../../lib/utils";
import { api } from "../../utils/api";
import { type Day } from "../../utils/types";
import { usePostHog } from "posthog-js/react";

type Props = { day: Day };

export const DialogDinners = ({ day }: Props) => {
  const dinnersQuery = api.dinner.dinners.useQuery();

  return (
    <div className={cn("flex max-h-[80vh] flex-col gap-2 overflow-y-auto")}>
      {dinnersQuery.data?.dinners.map((dinner) => (
        <DialogDinner key={dinner.id} day={day} dinner={dinner} />
      ))}
    </div>
  );
};

type DialogDinnerProps = { day: Day; dinner: Dinner };

const DialogDinner = ({ day, dinner }: DialogDinnerProps) => {
  const posthog = usePostHog();
  const utils = api.useUtils();
  const planDinnerForDayMutation = api.plan.planDinnerForDay.useMutation({
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

  const handleClick = () => {
    posthog.capture("plan dinner from week page", {
      dinner: dinner.name,
      day: day.day,
    });

    return planDinnerForDayMutation.mutate({
      day: day.number,
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
