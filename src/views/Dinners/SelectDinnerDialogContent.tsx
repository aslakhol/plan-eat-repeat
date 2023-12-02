import {
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { type DinnerWithTags } from "../../utils/types";
import { DialogWeek } from "./DialogWeek";

type Props = { dinner?: DinnerWithTags };

export const SelectDinnerDialogContent = ({ dinner }: Props) => {
  if (!dinner) {
    return null;
  }

  return (
    <DialogContent className="h-full">
      <DialogHeader>
        <DialogTitle>{dinner.name}</DialogTitle>
      </DialogHeader>
      <div>
        <DialogWeek selectedDinner={dinner} />
      </div>
    </DialogContent>
  );
};
