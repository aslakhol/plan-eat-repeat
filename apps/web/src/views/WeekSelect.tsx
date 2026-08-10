import { ChevronLeft, Calendar, ChevronRight } from "lucide-react";
import { type Dispatch, type SetStateAction } from "react";
import { Button } from "../components/ui/button";
import { cn } from "~/lib/utils";

type WeekSelectProps = {
  setWeekOfSet: Dispatch<SetStateAction<number>>;
  weekLabel: string;
  floating?: boolean;
};

export const WeekSelect = ({
  setWeekOfSet,
  weekLabel,
  floating = false,
}: WeekSelectProps) => {
  return (
    <div
      className={cn(
        "flex items-center gap-2",
        floating &&
          "pointer-events-auto max-w-full rounded-full bg-white p-1.5 shadow-[0_2px_10px_rgba(60,50,40,.14)]",
      )}
    >
      <Button
        variant="outline"
        size="icon"
        aria-label="Previous week"
        className="h-[34px] w-[34px] shrink-0 rounded-full bg-white"
        onClick={() => setWeekOfSet((prev) => prev - 1)}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        aria-label="Current week"
        className="h-[34px] w-[34px] shrink-0 rounded-full bg-white"
        onClick={() => setWeekOfSet(0)}
      >
        <Calendar className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        aria-label="Next week"
        className="h-[34px] w-[34px] shrink-0 rounded-full bg-white"
        onClick={() => setWeekOfSet((prev) => prev + 1)}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      <div className="min-w-0 whitespace-nowrap px-2 pr-3 text-[13px] font-semibold">
        {weekLabel}
      </div>
    </div>
  );
};
