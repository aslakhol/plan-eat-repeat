import { cn } from "../lib/utils";
import { api } from "../utils/api";
import { type DinnerWithTags } from "../utils/types";

type Props = {
  dinner: DinnerWithTags;
};

export const Dinner = ({ dinner }: Props) => {
  const utils = api.useUtils();
  const toggleMutation = api.dinner.toggle.useMutation({
    onMutate: (input) => {
      void utils.dinner.weekPlan.cancel();

      const prevWeek = utils.dinner.weekPlan.getData();
      const prevDinners = utils.dinner.dinners.getData();

      utils.dinner.weekPlan.setData(undefined, (old) => {
        const dinnerExists = old?.week.findIndex(
          (day) => day?.id === input.dinnerId,
        );

        if (dinnerExists !== -1) {
          return {
            week:
              old?.week.map((day, index) =>
                index === dinnerExists ? undefined : day,
              ) ?? [],
          };
        }

        const firstAvailableDay = old?.week.findIndex(
          (day) => day === undefined,
        );

        return {
          week:
            old?.week.map((day, index) =>
              index === firstAvailableDay
                ? { ...dinner, plannedForDay: firstAvailableDay }
                : day,
            ) ?? [],
        };
      });

      utils.dinner.dinners.setData(undefined, (old) => {
        return {
          dinners:
            old?.dinners.map((dinner) =>
              dinner.id === input.dinnerId
                ? {
                    ...dinner,
                    plannedForDay: dinner.plannedForDay === null ? 8 : null,
                  }
                : dinner,
            ) ?? [],
        };
      });

      return { prevWeek, prevDinners };
    },
    onError: (_, __, context) => {
      if (context?.prevWeek) {
        utils.dinner.weekPlan.setData(undefined, context.prevWeek);
      }

      if (context?.prevDinners) {
        utils.dinner.dinners.setData(undefined, context.prevDinners);
      }
    },
    onSettled: () => {
      void utils.dinner.weekPlan.invalidate();
      void utils.dinner.dinners.invalidate();
    },
  });
  const dinnerIsPlanned = dinner.plannedForDay !== null;

  const handleClick = () => {
    toggleMutation.mutate({ dinnerId: dinner.id });
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
