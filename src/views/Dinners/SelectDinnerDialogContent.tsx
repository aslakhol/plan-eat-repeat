import { Button } from "../../components/ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { type DinnerWithTags } from "../../utils/types";
import { DialogWeek } from "../DialogWeek";

type Props = { dinner?: DinnerWithTags };

export const SelectDinnerDialogContent = ({ dinner }: Props) => {
  if (!dinner) {
    return null;
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{dinner.name}</DialogTitle>
        <DialogDescription>
          {dinner.plannedForDay !== null
            ? `is planned for ${dinner.plannedForDay} `
            : "not planned"}
        </DialogDescription>
      </DialogHeader>
      <div>
        <DialogWeek />
      </div>
      {dinner.plannedForDay !== null && (
        <DialogFooter>
          <Button variant={"secondary"}>Remove from plan</Button>
        </DialogFooter>
      )}
    </DialogContent>
  );
};
