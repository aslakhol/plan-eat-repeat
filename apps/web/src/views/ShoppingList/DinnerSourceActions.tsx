import { BookOpen, CalendarDays } from "lucide-react";
import { Button } from "~/components/ui/button";
import { type ShoppingDinnerSource } from "./DinnerPicker";

export function DinnerSourceActions({
  onSelect,
}: {
  onSelect: (source: ShoppingDinnerSource) => void;
}) {
  return (
    <div className="flex w-full flex-col gap-2.5">
      <Button
        variant="outline"
        className="h-12 justify-start rounded-xl bg-white"
        onClick={() => onSelect("plan")}
      >
        <CalendarDays className="size-4" /> From week plan
      </Button>
      <Button
        variant="outline"
        className="h-12 justify-start rounded-xl bg-white"
        onClick={() => onSelect("cookbook")}
      >
        <BookOpen className="size-4" /> From the cookbook
      </Button>
    </div>
  );
}
