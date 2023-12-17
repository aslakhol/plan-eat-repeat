import { type Dinner } from "@prisma/client";
import { cn } from "../../lib/utils";
import { api } from "../../utils/api";
import { usePostHog } from "posthog-js/react";
import { format, isSameDay } from "date-fns";

type Props = { date: Date; plannedDinner?: Dinner; closeDialog: () => void };

export const DialogDinners = ({ date, plannedDinner, closeDialog }: Props) => {
  const dinnersQuery = api.dinner.dinners.useQuery();

  return (
    <div className={cn("flex max-h-[80vh] flex-col gap-2 overflow-y-auto")}>
      {dinnersQuery.data?.dinners.map((dinner) => (
        <DialogDinner
          key={dinner.id}
          date={date}
          dinner={dinner}
          isPlanned={plannedDinner?.id === dinner.id}
          closeDialog={closeDialog}
        />
      ))}
    </div>
  );
};

type DialogDinnerProps = {
  date: Date;
  dinner: Dinner;
  isPlanned: boolean;
  closeDialog: () => void;
};

const DialogDinner = ({
  date,
  dinner,
  isPlanned,
  closeDialog,
}: DialogDinnerProps) => {
  const posthog = usePostHog();
  const utils = api.useUtils();
  const planDinnerForDateMutation = api.plan.planDinnerForDate.useMutation({
    onMutate: (input) => {
      void utils.plan.plannedDinners.cancel();

      const prevPlannedDinners = utils.plan.plannedDinners.getData();

      utils.plan.plannedDinners.setData(undefined, (old) => {
        return {
          plans:
            old?.plans.map((plan) => {
              if (isSameDay(plan.date, input.date)) {
                return {
                  ...plan,
                  dinnerId: input.dinnerId,
                  dinner: dinner,
                };
              }

              return plan;
            }) ?? [],
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
      posthog.capture("plan dinner from week page", {
        dinner: dinner.name,
        day: format(date, "EEE do"),
      });
      closeDialog();
    },
  });

  const handleClick = () => {
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
        isPlanned && "bg-accent/50 text-accent-foreground hover:bg-accent",
      )}
      onClick={handleClick}
    >
      <h3 className="font-semibold">{dinner.name}</h3>
    </div>
  );
};
