import { useDraggable } from "@dnd-kit/core";
import { type Dinner } from "@prisma/client";
import { cn } from "../../lib/utils";
import { api } from "../../utils/api";
import { CSS } from "@dnd-kit/utilities";

type DinnerSlotProps = { dinner?: Dinner };

export const DinnerSlot = ({ dinner }: DinnerSlotProps) => {
  if (!dinner) {
    return <div className="h-12 rounded-md "></div>;
  }

  return <DinnerSelected dinner={dinner} />;
};

type DinnerSelectedProps = { dinner: Dinner };

const DinnerSelected = ({ dinner }: DinnerSelectedProps) => {
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
    id: dinner?.id,
  });
  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined;

  return (
    <div
      style={style}
      className={cn(
        "flex h-12 flex-col-reverse rounded-md p-1 hover:bg-slate-100",
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
