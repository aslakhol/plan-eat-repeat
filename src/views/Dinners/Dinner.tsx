import { DialogTrigger } from "@radix-ui/react-dialog";
import { cn } from "../../lib/utils";
import { type DinnerWithTags } from "../../utils/types";

type Props = {
  dinner: DinnerWithTags;
  setSelectedDinnerId: (dinnerId: number) => void;
};

export const Dinner = ({ dinner, setSelectedDinnerId }: Props) => {
  const dinnerIsPlanned = dinner.plannedForDay !== null;

  return (
    <DialogTrigger asChild onClick={() => setSelectedDinnerId(dinner.id)}>
      <div
        className={cn(
          "flex flex-col rounded border px-4 py-2 hover:bg-accent/50 hover:text-accent-foreground",
          dinnerIsPlanned && "ring-2",
        )}
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
    </DialogTrigger>
  );
};
