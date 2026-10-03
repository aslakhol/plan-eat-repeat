import { type DinnerWithTags } from "../../utils/types";
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
import { MoreHorizontal } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  buildDinnerEditorHref,
  planSlotDateFromDate,
} from "~/lib/editor-navigation";
import { useDinnerWakeLock } from "~/hooks/use-keep-screen-awake";
import { DetailsMenu } from "~/components/ui/details-menu";
import { useAddDinnersToShoppingList } from "~/hooks/use-add-dinners-to-shopping-list";
import { LoadingIndicator } from "~/components/LoadingIndicator";
import { api } from "~/utils/api";

type Props = {
  dinner: Pick<DinnerWithTags, "id" | "name">;
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
  const addToShoppingList = useAddDinnersToShoppingList(closeDialog);
  useDinnerWakeLock(isOpen);
  const recipeQuery = api.dinner.get.useQuery(
    { dinnerId: dinner.id },
    { enabled: isOpen },
  );
  const recipe = recipeQuery.data?.dinner;

  const closeMenu = () => menuRef.current?.removeAttribute("open");
  const headerLabel = format(date, "EEEE, LLLL do, y");
  const actions = (
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
          Change Dinner
        </Button>
        <Link
          href={`/dinners/${dinner.id}`}
          className="hover:bg-muted flex w-full items-center gap-3 border-t px-3.5 py-3 text-left text-[13.5px] font-semibold"
          onClick={closeMenu}
        >
          Go to cookbook
        </Link>
        <Link
          href={buildDinnerEditorHref(dinner.id, {
            origin: "week",
            date: planSlotDateFromDate(date),
          })}
          className="hover:bg-muted flex w-full items-center gap-3 border-t px-3.5 py-3 text-left text-[13.5px] font-semibold"
          onClick={closeMenu}
        >
          Edit this Dinner
        </Link>
        <Button
          type="button"
          variant="ghost"
          disabled={!addToShoppingList.isReady}
          className="h-auto w-full justify-start rounded-none border-t px-3.5 py-3 text-left text-[13.5px] font-semibold"
          onClick={() => {
            closeMenu();
            addToShoppingList.add([dinner]);
          }}
        >
          Add to shopping list
        </Button>
        <ClearDay
          date={date}
          closeDialog={closeDialog}
          variant="ghost"
          className="text-destructive hover:bg-destructive/5 hover:text-destructive h-auto w-full justify-start rounded-none border-t px-3.5 py-3 text-[13.5px] font-semibold"
          onBeforeClear={closeMenu}
        >
          Clear {format(date, "EEEE")}
        </ClearDay>
      </div>
    </DetailsMenu>
  );

  return (
    <ResponsiveModalContent className="flex h-auto max-h-[92dvh] max-w-[640px] flex-col overflow-hidden bg-white md:h-[min(90dvh,800px)]">
      <ResponsiveModalTitle className="sr-only">
        {dinner.name}
      </ResponsiveModalTitle>
      <ResponsiveModalDescription className="sr-only">
        Planned Dinner for {headerLabel}
      </ResponsiveModalDescription>

      <ResponsiveModalScrollViewport className="-mx-1 min-h-0 flex-1 px-1 pt-2">
        {recipe ? (
          <RecipeView
            dinner={recipe}
            headerLabel={headerLabel}
            headerAction={actions}
          />
        ) : (
          <div className="mx-auto w-full max-w-[640px] space-y-3 px-1 pb-2">
            <div className="flex items-center gap-3">
              <p className="text-muted-foreground min-w-0 flex-1 text-[13px] font-semibold">
                {headerLabel}
              </p>
              {actions}
            </div>
            <h1 className="font-serif text-[26px] font-normal leading-[1.2]">
              {dinner.name}
            </h1>
            {recipeQuery.isPending ? (
              <LoadingIndicator label="Loading recipe…" />
            ) : (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <p className="text-muted-foreground text-sm">
                  Couldn&apos;t load the recipe.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  disabled={recipeQuery.isFetching}
                  onClick={() => void recipeQuery.refetch()}
                >
                  Try again
                </Button>
              </div>
            )}
          </div>
        )}
      </ResponsiveModalScrollViewport>
    </ResponsiveModalContent>
  );
};
