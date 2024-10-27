import { format } from "date-fns";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { type DinnerWithTags } from "../../utils/types";
import { DialogContent } from "@radix-ui/react-dialog";
import { api } from "../../utils/api";
import { cn } from "../../lib/utils";

type Props = {
  date: Date;
  closeDialog: () => void;
  plannedDinner?: DinnerWithTags;
};

export const PlanDay = ({ date, closeDialog, plannedDinner }: Props) => {
  const dinnersQuery = api.dinner.dinners.useQuery();

  return (
    <>
      <DialogHeader>
        <DialogDescription>
          {format(date, "EEEE, LLLL  do, y")}
        </DialogDescription>
        <DialogTitle>
          {plannedDinner ? plannedDinner.name : "Nothing planned yet"}
        </DialogTitle>
      </DialogHeader>
      <div>
        {/* Filters and search */}
        {/* List of dinners */}
        {dinnersQuery.data?.dinners.map((dinner) => (
          <Dinner key={dinner.id} dinner={dinner} />
        ))}
        {/* New dinner link */}
        {/* Clear plan */}
      </div>
    </>
  );
};

type DinnerProps = { dinner: DinnerWithTags; plannedDinner?: DinnerWithTags };

const Dinner = ({ dinner, plannedDinner }: DinnerProps) => {
  const isPlanned = plannedDinner?.id === dinner.id;

  const handleClick = () => {
    console.log("clicked");
  };

  return (
    <div
      className={cn(
        "flex cursor-pointer flex-col rounded border px-4 py-2 hover:bg-accent/50 hover:text-accent-foreground",
        isPlanned && "bg-accent/50 text-accent-foreground hover:bg-accent",
      )}
      onClick={handleClick}
    >
      <h3 className="font-semibold">{dinner.name}</h3>
    </div>
  );
};
