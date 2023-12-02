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
import { DialogWeek } from "./DialogWeek";

type Props = { dinner?: DinnerWithTags };

export const SelectDinnerDialogContent = ({ dinner }: Props) => {
  const utils = api.useUtils();
  const unselectDinnerMutation = api.dinner.unselect.useMutation({
    onMutate: (input) => {
      void utils.dinner.dinners.cancel();

      const prevDinners = utils.dinner.dinners.getData();

      utils.dinner.dinners.setData(undefined, (old) => {
        return {
          dinners:
            old?.dinners.map((dinner) =>
              dinner.id === input.dinnerId
                ? {
                    ...dinner,
                    plannedForDay: null,
                  }
                : dinner,
            ) ?? [],
        };
      });

      return { prevDinners };
    },
    onError: (_, __, context) => {
      if (context?.prevDinners) {
        utils.dinner.dinners.setData(undefined, context.prevDinners);
      }
    },
    onSettled: () => {
      void utils.dinner.dinners.invalidate();
    },
  });

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
