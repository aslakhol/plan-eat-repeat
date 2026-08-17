import { type DinnerWithRecipe } from "../../utils/types";
import { format } from "date-fns";
import {
  ResponsiveModalContent,
  ResponsiveModalScrollViewport,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
} from "../../components/ResponsiveModal";
import { ClearDay } from "./ClearDay";
import Link from "next/link";
import { useRef } from "react";
import { RecipeView } from "../Dinners/RecipeView";
import { ArrowRightLeft, MoreHorizontal, Pencil, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  buildDinnerEditorHref,
  planSlotDateFromDate,
} from "~/lib/editor-navigation";
import { useDinnerWakeLock } from "~/hooks/use-keep-screen-awake";
import { DetailsMenu } from "~/components/ui/details-menu";

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
  const menuRef = useRef<HTMLDetailsElement>(null);
  useDinnerWakeLock(isOpen);

  const closeMenu = () => menuRef.current?.removeAttribute("open");

  return (
    <ResponsiveModalContent className="flex h-auto max-h-[92dvh] max-w-[640px] flex-col overflow-hidden bg-white md:h-[min(90dvh,800px)]">
      <ResponsiveModalTitle className="sr-only">
        {dinner.name}
      </ResponsiveModalTitle>
      <ResponsiveModalDescription className="sr-only">
        Planned Dinner for {format(date, "EEEE, LLLL do, y")}
      </ResponsiveModalDescription>

      <ResponsiveModalScrollViewport className="-mx-1 min-h-0 flex-1 px-1 pt-2">
        <RecipeView
          dinner={dinner}
          headerLabel={format(date, "EEEE, LLLL do, y")}
          headerAction={
            <DetailsMenu ref={menuRef} className="relative">
              <summary className="text-muted-foreground flex h-[30px] w-[30px] cursor-pointer list-none items-center justify-center rounded-full border bg-white [&::-webkit-details-marker]:hidden">
                <MoreHorizontal className="size-4" />
                <span className="sr-only">Planned Dinner actions</span>
              </summary>
              <div className="border-border absolute right-0 top-9 z-20 w-[230px] overflow-hidden rounded-[14px] border bg-white shadow-[0_8px_28px_rgba(60,50,40,.22)]">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto w-full justify-start rounded-none px-3.5 py-3 text-left text-[13.5px] font-semibold"
                  onClick={() => {
                    closeMenu();
                    setChangePlan(true);
                  }}
                >
                  <ArrowRightLeft className="size-4" />
                  Change Dinner
                </Button>
                <Link
                  href={buildDinnerEditorHref(dinner.id, {
                    origin: "week",
                    date: planSlotDateFromDate(date),
                  })}
                  className="hover:bg-muted flex w-full items-center gap-3 border-t px-3.5 py-3 text-left text-[13.5px] font-semibold"
                  onClick={closeMenu}
                >
                  <Pencil className="size-4" />
                  Edit this Dinner
                </Link>
                <ClearDay
                  date={date}
                  closeDialog={closeDialog}
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/5 hover:text-destructive h-auto w-full justify-start rounded-none border-t px-3.5 py-3 text-[13.5px] font-semibold"
                  onBeforeClear={closeMenu}
                >
                  <X className="size-4" />
                  Clear {format(date, "EEEE")}
                </ClearDay>
              </div>
            </DetailsMenu>
          }
        />
      </ResponsiveModalScrollViewport>
    </ResponsiveModalContent>
  );
};
