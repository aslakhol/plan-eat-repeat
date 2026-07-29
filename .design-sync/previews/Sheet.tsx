import * as React from "react";
import {
  Badge,
  Button,
  Input,
  Label,
  Separator,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@planeatrepeat/web";
import { CalendarDays, SlidersHorizontal, UtensilsCrossed } from "lucide-react";

// `open` is set so the panel renders in the card. SheetContent portals to
// document.body, so the trigger is what keeps the card root non-empty.
export const Filters = () => (
  <Sheet open>
    <SheetTrigger asChild>
      <Button variant="outline">
        <SlidersHorizontal className="mr-2 h-4 w-4" />
        Filters
      </Button>
    </SheetTrigger>
    <SheetContent side="right">
      <SheetHeader>
        <SheetTitle className="font-serif">Filter dinners</SheetTitle>
        <SheetDescription>
          Narrow your household&apos;s dinners by name or tag.
        </SheetDescription>
      </SheetHeader>
      <div className="space-y-4 py-6">
        <div className="space-y-2">
          <Label htmlFor="sheet-dinner-search">Search</Label>
          <Input id="sheet-dinner-search" defaultValue="curry" />
        </div>
        <Separator />
        <div className="space-y-2">
          <Label>Tags</Label>
          <div className="flex flex-wrap gap-2">
            {[
              { tag: "Vegetarian", on: true },
              { tag: "Quick", on: true },
              { tag: "Pasta", on: false },
              { tag: "Asian", on: false },
              { tag: "Comfort", on: false },
            ].map(({ tag, on }) => (
              <Badge
                key={tag}
                variant="secondary"
                className={
                  on
                    ? "border-primary bg-primary/10 cursor-pointer border"
                    : "cursor-pointer"
                }
              >
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      </div>
      <SheetFooter>
        <SheetClose asChild>
          <Button variant="secondary">Clear</Button>
        </SheetClose>
        <Button>Show 12 dinners</Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
);

// `side="left"` — the placement the app uses for its mobile navigation sheet.
export const LeftNavigation = () => (
  <Sheet open>
    <SheetTrigger asChild>
      <Button variant="ghost">Menu</Button>
    </SheetTrigger>
    <SheetContent side="left">
      <SheetHeader>
        <SheetTitle className="font-serif">Hollund household</SheetTitle>
        <SheetDescription>Four people, one weekly plan.</SheetDescription>
      </SheetHeader>
      <nav className="flex flex-col gap-1 py-6">
        <span className="bg-accent text-accent-foreground flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
          <CalendarDays className="h-4 w-4" />
          This week
        </span>
        <span className="hover:bg-accent flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
          <UtensilsCrossed className="h-4 w-4" />
          Dinners
        </span>
      </nav>
    </SheetContent>
  </Sheet>
);
