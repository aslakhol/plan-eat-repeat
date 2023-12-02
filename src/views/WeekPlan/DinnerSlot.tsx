import { type Dinner } from "@prisma/client";
import { cn } from "../../lib/utils";

type DinnerSlotProps = { dinner?: Dinner };

export const DinnerSlot = ({ dinner }: DinnerSlotProps) => {
  if (!dinner) {
    return <div className="h-12 rounded-md "></div>;
  }

  return <DinnerSelected dinner={dinner} />;
};

type DinnerSelectedProps = { dinner: Dinner };

const DinnerSelected = ({ dinner }: DinnerSelectedProps) => {
  return (
    <div
      className={cn(
        "flex h-12 flex-col-reverse rounded-md p-1 hover:bg-slate-100",
      )}
    >
      <p className={cn("font-semibold")}>{dinner.name}</p>
    </div>
  );
};
