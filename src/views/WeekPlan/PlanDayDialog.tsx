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

type Props = {
  day?: Day;
};

export const PlanDayDialog = ({ day }: Props) => {
  return (
    <DialogContent className="h-full">
      <DialogHeader>
        <DialogTitle>{day?.day}</DialogTitle>
        <DialogDescription>
          {day?.plannedDinner ? day?.plannedDinner.name : "No dinner planned"}
        </DialogDescription>
      </DialogHeader>
      <div>{day && <DialogDinners day={day} />}</div>
      <DialogFooter>
        <Button variant={"secondary"}>Clear day</Button>
      </DialogFooter>
    </DialogContent>
  );
};
