import { type Dinner } from "@prisma/client";
import { api } from "../utils/api";
import { cn } from "../lib/utils";
import { getWeekPlan } from "../utils/dinner";
import { useDraggable, useDroppable } from "@dnd-kit/core";

export const WeekPlan = () => {
  const dinnersQuery = api.dinner.dinners.useQuery();

  const weekPlan = getWeekPlan(dinnersQuery.data?.dinners);

  const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  return (
    <div className="flex flex-col items-end justify-start bg-gray-50 p-6 dark:bg-gray-900">
      <h2 className="mb-8 text-right text-xl font-bold">Week Plan</h2>
      <div className="w-full space-y-4 text-right">
        {days.map((day, index) => (
          <Day key={day} day={day} dinner={weekPlan[index]} />
        ))}
      </div>
    </div>
  );
};

type DayProps = { day: string; dinner?: Dinner };

const Day = ({ day, dinner }: DayProps) => {
  const { isOver, setNodeRef } = useDroppable({
    id: day,
  });

  return (
    <div
      className={cn(
        "flex flex-col rounded border px-2 py-2",
        isOver && "bg-green-400",
      )}
      ref={setNodeRef}
    >
      <h3 className="mb-2 mr-1 text-xs">{day}</h3>
      <Dinner dinner={dinner} />
    </div>
  );
};

type DinnerProps = { dinner?: Dinner };

const Dinner = ({ dinner }: DinnerProps) => {
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

  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: dinner?.id ?? "",
  });
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  if (!dinner) {
    return <div className="h-12 rounded-md border"></div>;
  }

  return (
    <div
      style={style}
      className={cn(
        "flex h-12 flex-col-reverse rounded-md border p-1 hover:bg-slate-100",
      )}
      onClick={() => unselectDinnerMutation.mutate({ dinnerId: dinner.id })}
      ref={setNodeRef}
      {...attributes}
      {...listeners}
    >
      <p className={cn("font-semibold")}>{dinner.name}</p>
    </div>
  );
};
