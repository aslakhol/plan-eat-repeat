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
import { format } from "date-fns";

type Props = {
  date?: Date;
  plannedDinner?: Dinner;
};

export const PlanDayDialog = ({ date, plannedDinner }: Props) => {
  const posthog = usePostHog();
  const utils = api.useUtils();
  const unplanDinnerMutation = api.plan.unplanDay.useMutation({
    // onMutate: (input) => {
    //   void utils.dinner.dinners.cancel();

    //   const prevDinners = utils.dinner.dinners.getData();

    //   utils.dinner.dinners.setData(undefined, (old) => {
    //     return {
    //       dinners:
    //         old?.dinners.map((dinner) =>
    //           dinner.plannedForDay === input.day
    //             ? {
    //                 ...dinner,
    //                 plannedForDay: null,
    //               }
    //             : dinner,
    //         ) ?? [],
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
  if (!date) {
    return null;
  }

  const handleClear = () => {
    posthog.capture("clear day", { day: format(date, "EEE do") });

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
          {plannedDinner ? plannedDinner.name : "No dinner planned"}
        </DialogDescription>
      </DialogHeader>
      <div>
        {date && <DialogDinners date={date} plannedDinner={plannedDinner} />}
      </div>
      {plannedDinner && (
        <DialogFooter>
          <Button variant={"secondary"} onClick={handleClear}>
            Clear day
          </Button>
        </DialogFooter>
      )}
    </DialogContent>
  );
};
