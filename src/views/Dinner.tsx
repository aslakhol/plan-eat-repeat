import { useEffect } from "react";
import { cn } from "../lib/utils";
import { api } from "../utils/api";
import { getFirstAvailableDay } from "../utils/dinner";
import { type DinnerWithTags } from "../utils/types";

type Props = {
  dinner: DinnerWithTags;
};

export const Dinner = ({ dinner }: Props) => {
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
  const dinnerIsPlanned = dinner.plannedForDay !== null;

  const handleClick = () => {
    toggleMutation.mutate({
      dinnerId: dinner.id,
      secret: localStorage.getItem("sulten-secret"),
    });
  };

  return (
    <div
      className={cn(
        "flex flex-col rounded border px-4 py-2 hover:bg-accent/50 hover:text-accent-foreground",
        dinnerIsPlanned && "ring-2",
      )}
      onClick={handleClick}
    >
      <h3 className="font-semibold">{dinner.name}</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {dinner.tags.map((tag) => {
          return (
            <div
              key={tag.value}
              className="rounded bg-green-100 px-2 py-1 text-green-800 active:bg-green-200"
            >
              {tag.value}
            </div>
          );
        })}
      </div>
    </div>
  );
};
