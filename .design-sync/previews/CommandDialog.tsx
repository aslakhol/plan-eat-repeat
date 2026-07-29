import * as React from "react";
import {
  Button,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@planeatrepeat/web";
import { CalendarDays, Plus, Search, UtensilsCrossed } from "lucide-react";

// CommandDialog is controlled only, so `open` is set to render the palette.
// It ships no trigger of its own — the ⌘K button beside it is what keeps the
// card root non-empty while the panel portals to document.body.
export const Open = () => (
  <div>
    <Button variant="outline" className="text-muted-foreground w-56 justify-start">
      <Search className="mr-2 h-4 w-4" />
      Jump to…
      <CommandShortcut>⌘K</CommandShortcut>
    </Button>
    <CommandDialog open>
      <CommandInput placeholder="Jump to…" />
      <CommandList>
        <CommandEmpty>Nothing matches.</CommandEmpty>
        <CommandGroup heading="Pages">
          <CommandItem>
            <CalendarDays />
            This week
          </CommandItem>
          <CommandItem>
            <UtensilsCrossed />
            Dinners
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem>
            <Plus />
            New dinner
          </CommandItem>
          <CommandItem>
            <CalendarDays />
            Plan Tuesday
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  </div>
);
