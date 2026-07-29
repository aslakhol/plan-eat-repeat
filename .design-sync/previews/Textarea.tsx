import * as React from "react";
import { Button, Label, Textarea } from "@planeatrepeat/web";

export const Basic = () => (
  <div className="max-w-sm space-y-2">
    <Label htmlFor="dinner-notes">Notes</Label>
    <Textarea
      id="dinner-notes"
      rows={4}
      placeholder="Anything worth remembering…"
    />
  </div>
);

export const WithDescription = () => (
  <div className="max-w-sm space-y-2">
    <Label htmlFor="import-instructions">Recipe import instructions</Label>
    <Textarea
      id="import-instructions"
      maxLength={1000}
      placeholder="Keep steps short and explain techniques for beginners"
    />
    <p className="text-muted-foreground text-sm">
      Shape every imported recipe. For example: “Keep steps short”, or “Explain
      techniques for beginners”.
    </p>
  </div>
);

export const Filled = () => (
  <div className="max-w-sm space-y-3">
    <div className="space-y-2">
      <Label htmlFor="paste-recipe">Paste recipe text</Label>
      <Textarea
        id="paste-recipe"
        className="min-h-40 bg-white text-[15px]"
        defaultValue={
          "Chicken curry with rice\n\n400 g chicken thighs\n2 tbsp curry paste\n400 ml coconut milk\n\nSimmer 20 minutes, serve with rice."
        }
      />
    </div>
    <Button>Import pasted recipe</Button>
  </div>
);

export const WithError = () => (
  <div className="max-w-sm space-y-2">
    <Label htmlFor="too-long-notes" className="text-destructive">
      Recipe import instructions
    </Label>
    <Textarea
      id="too-long-notes"
      aria-invalid
      defaultValue="Write every instruction in Norwegian, list the equipment first, explain each technique for a complete beginner, and always add a suggested side dish…"
    />
    <p className="text-destructive text-sm font-medium">
      Instructions must be 1000 characters or fewer
    </p>
  </div>
);

export const Disabled = () => (
  <div className="max-w-sm space-y-2">
    <Label htmlFor="disabled-notes">Notes</Label>
    <Textarea
      id="disabled-notes"
      disabled
      defaultValue="Double the sauce — the kids always want extra."
    />
  </div>
);
