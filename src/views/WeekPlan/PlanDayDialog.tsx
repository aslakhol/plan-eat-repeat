import { Button } from "../../components/ui/button";
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { DialogDinners } from "./DialogDinners";

type Props = {
  day?: string;
  dayNumber?: number;
};

export const PlanDayDialog = ({ day, dayNumber }: Props) => {
  return (
    <DialogContent className="h-full">
      <DialogHeader>
        <DialogTitle>
          {day} {dayNumber}
        </DialogTitle>
      </DialogHeader>
      <div>{dayNumber && <DialogDinners dayNumber={dayNumber} />}</div>
      <DialogFooter>
        <Button variant={"secondary"}>Clear day</Button>
      </DialogFooter>
    </DialogContent>
  );
};
