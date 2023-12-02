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

type Props = {
  day?: Day;
  plannedDinner?: Dinner;
};

export const PlanDayDialog = ({ day, plannedDinner }: Props) => {
  const clearDayMutation = api.dinner.clearDay.useMutation();

  const handleClear = () => {
    if (!day) {
      return;
    }

    clearDayMutation.mutate({
      day: day.number,
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
