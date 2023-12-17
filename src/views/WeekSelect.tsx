import { format } from "date-fns";
import { ChevronLeft, Calendar, ChevronRight } from "lucide-react";
import { type Dispatch, type SetStateAction } from "react";
import { Button } from "../components/ui/button";

type WeekSelectProps = {
  setWeekOfSet: Dispatch<SetStateAction<number>>;
  startOfDisplayedWeek: Date;
};

export const WeekSelect = ({
  setWeekOfSet,
  startOfDisplayedWeek,
}: WeekSelectProps) => {
  return (
    <>
      <div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => setWeekOfSet((prev) => prev - 1)}
          >
            <span className="sr-only">Go back 1 week</span>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => setWeekOfSet(0)}
          >
            <span className="sr-only">Go to today</span>
            <Calendar className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => setWeekOfSet((prev) => prev + 1)}
          >
            <span className="sr-only">Go forward 1 week</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="px-4 text-sm font-medium">
            Week {format(startOfDisplayedWeek, "w, MMMM, yyyy")}
          </div>
        </div>
      </div>
    </>
  );
};
