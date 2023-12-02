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

type Props = {
  day?: Day;
};

export const PlanDayDialog = ({ day }: Props) => {
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
          {day?.plannedDinner ? day?.plannedDinner.name : "No dinner planned"}
        </DialogDescription>
      </DialogHeader>
      <div>{day && <DialogDinners day={day} />}</div>
      {day?.plannedDinner && (
        <DialogFooter>
          <Button variant={"secondary"} onClick={handleClear}>
            Clear day
          </Button>
        </DialogFooter>
      )}
    </DialogContent>
  );
};
