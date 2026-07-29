import * as React from "react";
import {
  Badge,
  Button,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@planeatrepeat/web";

// `open` is set so the panel renders in the card. DrawerContent portals to
// document.body, so the trigger is what keeps the card root non-empty.
// DrawerContent draws its own grab handle above the header.
export const Open = () => (
  <Drawer open shouldScaleBackground={false}>
    <DrawerTrigger asChild>
      <Button>Plan dinner</Button>
    </DrawerTrigger>
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle className="font-serif">Plan Tuesday</DrawerTitle>
        <DrawerDescription>
          Pick a dinner for 4 March from your household&apos;s list.
        </DrawerDescription>
      </DrawerHeader>
      <div className="flex flex-col gap-2 px-1 py-2">
        {[
          { name: "Thai green curry", tags: ["Asian", "Quick"] },
          { name: "Mushroom risotto", tags: ["Vegetarian", "Comfort"] },
          { name: "Fish tacos", tags: ["Fish"] },
        ].map((dinner) => (
          <button
            key={dinner.name}
            type="button"
            className="hover:bg-accent border-border flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors"
          >
            <span className="font-serif text-base leading-tight">
              {dinner.name}
            </span>
            <span className="flex flex-wrap gap-1">
              {dinner.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </span>
          </button>
        ))}
      </div>
      <DrawerFooter>
        <Button>Save to Tuesday</Button>
        <DrawerClose asChild>
          <Button variant="outline">Cancel</Button>
        </DrawerClose>
      </DrawerFooter>
    </DrawerContent>
  </Drawer>
);
