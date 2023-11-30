import { Button } from "../../components/ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { api } from "../../utils/api";
import { type DinnerWithTags } from "../../utils/types";
import { DialogWeek } from "../DialogWeek";

type Props = { dinner?: DinnerWithTags };

export const SelectDinnerDialogContent = ({ dinner }: Props) => {
  const toggleMutation = api.dinner.toggle.useMutation();

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
        <DialogWeek selectedDinner={dinner} />
      </div>
      {dinner.plannedForDay !== null && (
        <DialogFooter>
          <Button
            variant={"secondary"}
            onClick={() =>
              toggleMutation.mutate({
                dinnerId: dinner.id,
                secret: localStorage.getItem("sulten-secret"),
              })
            }
          >
            Remove from plan
          </Button>
        </DialogFooter>
      )}
    </DialogContent>
  );
};
