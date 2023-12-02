import { type Dinner } from "@prisma/client";
import { cn } from "../../lib/utils";
import { api } from "../../utils/api";

type Props = { dayNumber: number };

export const DialogDinners = ({}: Props) => {
  const dinnersQuery = api.dinner.dinners.useQuery();

  return (
    <div className={cn("flex max-h-[85vh] flex-col gap-2 overflow-y-auto")}>
      {dinnersQuery.data?.dinners.map((dinner) => (
        <DialogDinner key={dinner.id} dinner={dinner} />
      ))}
    </div>
  );
};

type DialogDinnerProps = { dinner: Dinner };

const DialogDinner = ({ dinner }: DialogDinnerProps) => {
  return (
    <>
      <div
        className={cn(
          "flex cursor-pointer flex-col rounded border px-4 py-2 hover:bg-accent/50 hover:text-accent-foreground",
          // dinnerIsPlanned && "ring-2",
        )}
      >
        <h3 className="font-semibold">{dinner.name}</h3>
      </div>
    </>
  );
};
