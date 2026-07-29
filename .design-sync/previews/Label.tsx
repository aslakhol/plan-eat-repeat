import * as React from "react";
import { Input, Label, Textarea } from "@planeatrepeat/web";

export const Basic = () => (
  <div className="max-w-sm space-y-2">
    <Label htmlFor="household-slug">Household URL</Label>
    <Input id="household-slug" defaultValue="the-hollunds" />
  </div>
);

export const Standalone = () => (
  <div className="flex flex-col gap-3">
    <Label>Dinner name</Label>
    <Label>Recipe import instructions</Label>
    <Label className="text-destructive">Household slug</Label>
    <Label className="text-muted-foreground">Tags</Label>
  </div>
);

export const FieldStack = () => (
  <div className="max-w-sm space-y-4">
    <div className="space-y-2">
      <Label htmlFor="stack-name">Dinner name</Label>
      <Input id="stack-name" defaultValue="Fish tacos" />
    </div>
    <div className="space-y-2">
      <Label htmlFor="stack-notes">Notes</Label>
      <Textarea
        id="stack-notes"
        rows={3}
        placeholder="Anything worth remembering…"
      />
    </div>
  </div>
);

// Input first in the DOM so `peer-disabled:` can reach the label;
// flex-col-reverse puts the label back on top visually.
export const DisabledField = () => (
  <div className="flex max-w-sm flex-col-reverse gap-2">
    <Input
      id="disabled-slug"
      className="peer"
      defaultValue="the-hollunds"
      disabled
    />
    <Label htmlFor="disabled-slug">Household URL</Label>
  </div>
);
