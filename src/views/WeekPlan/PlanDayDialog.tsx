import { DialogDescription } from "@radix-ui/react-dialog";
import { Button } from "../../components/ui/button";
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { type Day } from "../../utils/types";
import { DialogDinners } from "./DialogDinners";
import { api } from "../../utils/api";
import { type Dinner } from "@prisma/client";
import { usePostHog } from "posthog-js/react";

type Props = {
  day?: Day;
  plannedDinner?: Dinner;
};

export const PlanDayDialog = ({ day, plannedDinner }: Props) => {
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

  const handleClear = () => {
    if (!day) {
      return;
    }

    posthog.capture("clear day", { day: day.day });

    unplanDinnerMutation.mutate({
      date: day.date,
      secret: localStorage.getItem("sulten-secret"),
    });
  };

  return (
    <DialogContent className="h-full">
      <DialogHeader>
        <DialogTitle>{day?.day}</DialogTitle>
        <DialogDescription>
          {plannedDinner ? plannedDinner.name : "No dinner planned"}
        </DialogDescription>
      </DialogHeader>
      <div>{day && <DialogDinners day={day} />}</div>
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
