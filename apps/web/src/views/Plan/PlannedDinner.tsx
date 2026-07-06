import { Button } from "../../components/ui/button";
import { type DinnerWithRecipe } from "../../utils/types";
import { format } from "date-fns";
import {
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
} from "../../components/ResponsiveModal";
import { ClearDay } from "./ClearDay";
import Link from "next/link";
import useWakeLock from "react-use-wake-lock";
import { useEffect } from "react";
import { RecipeView } from "../Dinners/RecipeView";

type Props = {
  dinner: DinnerWithRecipe;
  date: Date;
  closeDialog: () => void;
  setChangePlan: (change: boolean) => void;
  isOpen: boolean;
};

export const PlannedDinner = ({
  dinner,
  date,
  closeDialog,
  setChangePlan,
  isOpen,
}: Props) => {
  const { isSupported, request, release } = useWakeLock();

  useEffect(() => {
    if (!isSupported) {
      return;
    }
    if (!isOpen) {
      release();
      return;
    }

    request();

    return () => {
      release();
    };
  }, [isSupported, isOpen, request, release]);

  return (
    <ResponsiveModalContent className="flex h-[85dvh] max-h-[85dvh] max-w-[640px] flex-col overflow-hidden">
      <ResponsiveModalHeader className="shrink-0 pr-6">
        <ResponsiveModalDescription>
          {format(date, "EEEE, LLLL do, y")}
        </ResponsiveModalDescription>
        <ResponsiveModalTitle className="sr-only">
          {dinner.name}
        </ResponsiveModalTitle>
      </ResponsiveModalHeader>

      <div className="flex shrink-0 flex-wrap gap-2">
        <Button variant="outline" onClick={() => setChangePlan(true)}>
          Change dinner
        </Button>
        <ClearDay date={date} closeDialog={closeDialog} />
        <Button variant="outline" asChild>
          <Link href={`/dinners/${dinner.id}?edit=1`}>Edit</Link>
        </Button>
      </div>

      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 pt-2">
        <RecipeView dinner={dinner} showEditButton={false} />
      </div>
    </ResponsiveModalContent>
  );
};
