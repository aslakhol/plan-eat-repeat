import { format, isToday } from "date-fns";
import { cn } from "../../lib/utils";
import { PlannedDinner } from "./PlannedDinner";
import { type DinnerWithRecipe } from "../../utils/types";
import { useState } from "react";
import { PlanDay } from "./PlanDay";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import {
  ResponsiveModal,
  ResponsiveModalTrigger,
} from "../../components/ResponsiveModal";
import { Plus } from "lucide-react";

type Props = {
  date: Date;
  plannedDinner?: DinnerWithRecipe;
};

export const Day = ({ date, plannedDinner }: Props) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [changePlan, setChangePlan] = useState(!plannedDinner);

  const onOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setChangePlan(false);
    }
  };

  const isDateToday = isToday(date);

  return (
    <ResponsiveModal open={dialogOpen} onOpenChange={onOpenChange}>
      <ResponsiveModalTrigger asChild>
        <Card
          data-testid="plan-day-trigger"
          data-date={format(date, "yyyy-MM-dd")}
          className={cn(
            "hover:bg-accent/50 group relative flex h-full min-h-[80px] cursor-pointer flex-col overflow-hidden transition-colors sm:min-h-[140px]",
            !plannedDinner &&
              "hover:border-primary/50 border-dashed bg-transparent",
            plannedDinner &&
              "border-secondary bg-secondary/30 hover:bg-secondary/50",
            isDateToday && "ring-primary ring-2 ring-offset-2",
          )}
        >
          <CardHeader className="p-3 pb-1 sm:p-4 sm:pb-2">
            <CardTitle
              className={cn(
                "text-muted-foreground flex items-center justify-between font-sans text-sm font-medium",
                isDateToday && "text-primary font-bold",
              )}
            >
              {format(date, "EEE do")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-center p-3 pt-0 sm:p-4 sm:pt-0">
            {plannedDinner ? (
              <p className="line-clamp-3 font-serif text-base font-medium leading-tight sm:line-clamp-2 sm:text-lg">
                {plannedDinner.name}
              </p>
            ) : (
              <div className="text-muted-foreground/50 group-hover:text-primary/50 flex h-full items-center justify-center transition-colors">
                <Plus className="h-6 w-6 sm:h-8 sm:w-8" />
              </div>
            )}
          </CardContent>
        </Card>
      </ResponsiveModalTrigger>
      <>
        {changePlan || !plannedDinner ? (
          <PlanDay
            date={date}
            closeDialog={() => onOpenChange(false)}
            plannedDinner={plannedDinner}
          />
        ) : (
          <PlannedDinner
            dinner={plannedDinner}
            date={date}
            closeDialog={() => onOpenChange(false)}
            setChangePlan={setChangePlan}
            isOpen={dialogOpen}
          />
        )}
      </>
    </ResponsiveModal>
  );
};
