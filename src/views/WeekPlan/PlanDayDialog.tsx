import { DialogDescription } from "@radix-ui/react-dialog";
import { Button } from "../../components/ui/button";
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { DialogDinners } from "./DialogDinners";
import { api } from "../../utils/api";
import { type Dinner } from "@prisma/client";
import { usePostHog } from "posthog-js/react";
import { format, isSameDay } from "date-fns";

type Props = {
  date?: Date;
  plannedDinner?: Dinner;
  closeDialog: () => void;
};

export const PlanDayDialog = ({ date, plannedDinner, closeDialog }: Props) => {
  const posthog = usePostHog();
  const utils = api.useUtils();
  const unplanDinnerMutation = api.plan.unplanDay.useMutation({
    onMutate: (input) => {
      void utils.plan.plannedDinners.cancel();

      const prevPlannedDinners = utils.plan.plannedDinners.getData();

      utils.plan.plannedDinners.setData(undefined, (old) => {
        return {
          plans:
            old?.plans.filter((plan) => !isSameDay(plan.date, input.date)) ??
            [],
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
    onSettled: async () => {
      await utils.dinner.dinners.invalidate();
    },
    onSuccess: (res) => {
      posthog.capture("clear day", { day: format(res.deleted.date, "EEE do") });
      closeDialog();
    },
  });

  if (!date) {
    return null;
  }

  const handleClear = () => {
    unplanDinnerMutation.mutate({
      date: date,
      secret: localStorage.getItem("sulten-secret"),
    });
  };

  return (
    <DialogContent className="h-full">
      <DialogHeader>
        <DialogTitle>{format(date, "EEE do")}</DialogTitle>
        <DialogDescription>
          {plannedDinner ? plannedDinner.name : "Nothing planned yet"}
        </DialogDescription>
      </DialogHeader>
      <div>
        {date && (
          <DialogDinners
            date={date}
            plannedDinner={plannedDinner}
            closeDialog={closeDialog}
          />
        )}
      </div>
      <DialogFooter>
        <Button
          variant={"secondary"}
          onClick={handleClear}
          disabled={!plannedDinner}
        >
          Clear day
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};
