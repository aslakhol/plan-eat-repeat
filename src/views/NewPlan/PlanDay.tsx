import { format } from "date-fns";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { type DinnerWithTags } from "../../utils/types";

type Props = {
  date: Date;
  closeDialog: () => void;
  plannedDinner?: DinnerWithTags;
};

export const PlanDay = ({ date, closeDialog, plannedDinner }: Props) => {
  return (
    <>
      <DialogHeader>
        <DialogDescription>
          {format(date, "EEEE, LLLL  do, y")}
        </DialogDescription>
        <DialogTitle>
          {plannedDinner ? plannedDinner.name : "Nothing planned yet"}
        </DialogTitle>
      </DialogHeader>
    </>
  );
};
