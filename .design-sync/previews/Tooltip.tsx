import * as React from "react";
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@planeatrepeat/web";
import { Info } from "lucide-react";

// Every tooltip needs a TooltipProvider ancestor. `open` is set so the
// content renders in the card; the trigger keeps the card root non-empty.
export const Open = () => (
  <TooltipProvider>
    <Tooltip open>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon">
          <Info className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Dinners you have not cooked recently</TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

// `side="right"` on an icon-only action, the way a collapsed sidebar labels
// its items.
export const SideRight = () => (
  <TooltipProvider>
    <Tooltip open>
      <TooltipTrigger asChild>
        <Button variant="outline">Plan Tuesday</Button>
      </TooltipTrigger>
      <TooltipContent side="right">Nothing planned yet</TooltipContent>
    </Tooltip>
  </TooltipProvider>
);
