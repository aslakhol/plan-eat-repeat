import { Button } from "../../components/ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { api } from "../../utils/api";
import { getFirstAvailableDay } from "../../utils/dinner";
import { type DinnerWithTags } from "../../utils/types";

type Props = { dinner?: DinnerWithTags };

export const SelectDinnerDialogContent = ({ dinner }: Props) => {
  const utils = api.useUtils();

  const toggleMutation = api.dinner.toggle.useMutation({
    onMutate: (input) => {
      void utils.dinner.dinners.cancel();

      const prevDinners = utils.dinner.dinners.getData();

      utils.dinner.dinners.setData(undefined, (old) => {
        const firstAvailableDays =
          getFirstAvailableDay(old?.dinners ?? []) ?? null;

        return {
          dinners:
            old?.dinners.map((dinner) =>
              dinner.id === input.dinnerId
                ? {
                    ...dinner,
                    plannedForDay:
                      dinner.plannedForDay === null ? firstAvailableDays : null,
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

  const handleClick = () => {
    toggleMutation.mutate({
      dinnerId: dinner.id,
      secret: localStorage.getItem("sulten-secret"),
    });
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{dinner.name}</DialogTitle>
        <DialogDescription>
          {dinner.name} is{" "}
          {dinner.plannedForDay !== null ? "planned" : "not planned"}{" "}
          {dinner.plannedForDay}
        </DialogDescription>
        <div>
          <Button onClick={handleClick}>Toggle</Button>
        </div>
      </DialogHeader>
    </DialogContent>
  );
};
