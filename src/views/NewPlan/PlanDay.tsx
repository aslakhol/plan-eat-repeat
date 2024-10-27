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
        <DialogTitle>{format(date, "EEE do")}</DialogTitle>
        <DialogDescription>
          {plannedDinner ? plannedDinner.name : "Nothing planned yet"}
        </DialogDescription>
      </DialogHeader>
    </>
  );
};
