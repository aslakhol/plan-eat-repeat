import { startOfWeek, isSameDay, format } from "date-fns";
import { usePostHog } from "posthog-js/react";
import { Button } from "../../components/ui/button";
import { api } from "../../utils/api";

type ClearDayProps = { date: Date; closeDialog: () => void };

export const ClearDay = ({ date, closeDialog }: ClearDayProps) => {
  const posthog = usePostHog();
  const utils = api.useUtils();
  const unplanDayMutation = api.plan.unplanDay.useMutation({
    onMutate: (input) => {
      void utils.plan.plannedDinners.cancel();
      const prevPlannedDinners = utils.plan.plannedDinners.getData();
      utils.plan.plannedDinners.setData(
        { startOfWeek: startOfWeek(date ?? new Date(), { weekStartsOn: 1 }) },
        (old) => {
          return {
            plans:
              old?.plans.filter((plan) => !isSameDay(plan.date, input.date)) ??
              [],
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
    onSettled: async () => {
      await utils.plan.plannedDinners.invalidate();
    },
    onSuccess: (res) => {
      posthog.capture("clear day", { day: format(res.deleted.date, "EEE do") });
      closeDialog();
    },
  });
  return (
    <Button
      variant={"outline"}
      onClick={() =>
        unplanDayMutation.mutate({
          date,
          secret: localStorage.getItem("sulten-secret"),
        })
      }
    >
      Clear day
    </Button>
  );
};
