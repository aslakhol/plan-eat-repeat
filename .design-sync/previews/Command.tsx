import * as React from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@planeatrepeat/web";
import { CalendarDays, Plus, UtensilsCrossed } from "lucide-react";

// Command is not an overlay — it renders inline. On its own it is unstyled
// chrome, so give it a border and a width to make it read as a palette.
export const Inline = () => (
  <Command className="border-border w-[360px] rounded-lg border shadow-sm">
    <CommandInput placeholder="Search dinners…" />
    <CommandList>
      <CommandEmpty>No dinners found.</CommandEmpty>
      <CommandGroup heading="This week">
        <CommandItem>
          <CalendarDays />
          Spaghetti carbonara
          <CommandShortcut>Mon</CommandShortcut>
        </CommandItem>
        <CommandItem>
          <CalendarDays />
          Thai green curry
          <CommandShortcut>Wed</CommandShortcut>
        </CommandItem>
      </CommandGroup>
      <CommandSeparator />
      <CommandGroup heading="All dinners">
        <CommandItem>
          <UtensilsCrossed />
          Mushroom risotto
        </CommandItem>
        <CommandItem>
          <UtensilsCrossed />
          Veggie buddha bowl
        </CommandItem>
        <CommandItem>
          <Plus />
          New dinner
          <CommandShortcut>⌘N</CommandShortcut>
        </CommandItem>
      </CommandGroup>
    </CommandList>
  </Command>
);

// Filtering runs off the item text, so a search with no matches falls
// through to CommandEmpty.
export const NoResults = () => (
  <Command className="border-border w-[360px] rounded-lg border shadow-sm">
    <CommandInput
      value="sushi"
      onValueChange={() => undefined}
      placeholder="Search dinners…"
    />
    <CommandList>
      <CommandEmpty>No dinners found.</CommandEmpty>
      <CommandGroup heading="All dinners">
        <CommandItem>Mushroom risotto</CommandItem>
        <CommandItem>Fish tacos</CommandItem>
      </CommandGroup>
    </CommandList>
  </Command>
);
