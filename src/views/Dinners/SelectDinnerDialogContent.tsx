import {
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { type DinnerWithTags } from "../../utils/types";
import { DialogWeek } from "./DialogWeek";

type Props = { dinner?: DinnerWithTags; closeDialog: () => void };

export const SelectDinnerDialogContent = ({ dinner, closeDialog }: Props) => {
  if (!dinner) {
    return null;
  }

  return (
    <DialogContent className="h-full">
      <DialogHeader>
        <DialogTitle>{dinner.name}</DialogTitle>
      </DialogHeader>
      <DialogWeek selectedDinner={dinner} closeDialog={closeDialog} />
    </DialogContent>
  );
};
