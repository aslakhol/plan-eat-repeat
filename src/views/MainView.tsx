import { api } from "~/utils/api";
import { Dinners } from "./Dinners";
import { WeekPlan } from "./WeekPlan/WeekPlan";
import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import { z } from "zod";

/**
 * v0 by Vercel.
 * @see https://v0.dev/t/Gun86UHtS3V
 */

export const MainView = () => {
  const dinnerQuery = api.dinner.dinners.useQuery();
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

  const onDragEnd = (event: DragEndEvent) => {
    console.log(event);

    if (event.over?.id === "dinnersSection") {
      const dinnerId = z.number().parse(event.active.data.current?.dinnerId);

      unselectDinnerMutation.mutate({
        dinnerId,
      });
    }
  };

  return (
    <DndContext modifiers={[restrictToWindowEdges]} onDragEnd={onDragEnd}>
      <div className="grid h-screen grid-cols-2">
        {dinnerQuery.data?.dinners && (
          <Dinners dinners={dinnerQuery.data.dinners} />
        )}

        <WeekPlan />
      </div>
    </DndContext>
  );
};
