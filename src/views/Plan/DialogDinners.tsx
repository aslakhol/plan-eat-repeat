import { type Plan, type Dinner } from "@prisma/client";
import { cn } from "../../lib/utils";
import { api } from "../../utils/api";
import { usePostHog } from "posthog-js/react";
import { format, isSameDay, startOfWeek } from "date-fns";

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

      utils.plan.plannedDinners.setData(
        { startOfWeek: startOfWeek(date ?? new Date(), { weekStartsOn: 1 }) },
        (old) => {
          const oldPlans = old?.plans ?? [];
          const alreadyPlanned = oldPlans.find((plan) =>
            isSameDay(plan.date, input.date),
          );
          const newPlan: Plan & { dinner: Dinner } = {
            ...alreadyPlanned,
            dinnerId: input.dinnerId,
            dinner,
            id: alreadyPlanned?.id ?? Math.ceil(Math.random() * -10000),
            date: input.date,
          };

          return {
            plans: [
              ...oldPlans.filter((plan) => plan.id !== newPlan.id),
              newPlan,
            ],
          };
        },
      );

      return { prevPlannedDinners };
    },
    onError: (_, __, context) => {
      if (context?.prevPlannedDinners) {
        utils.plan.plannedDinners.setData(
          { startOfWeek: startOfWeek(date ?? new Date(), { weekStartsOn: 1 }) },
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
