import * as React from "react";
import { Button, Input, Label } from "@planeatrepeat/web";
import { Search, Wand2 } from "lucide-react";

export const Basic = () => (
  <div className="max-w-sm space-y-2">
    <Label htmlFor="dinner-name">Dinner name</Label>
    <Input id="dinner-name" placeholder="Tomato pasta" />
  </div>
);

export const WithValue = () => (
  <div className="max-w-sm space-y-2">
    <Label htmlFor="household-name">Household name</Label>
    <Input id="household-name" defaultValue="The Hollunds" />
  </div>
);

export const Types = () => (
  <div className="max-w-sm space-y-4">
    <div className="space-y-2">
      <Label htmlFor="recipe-link">Recipe link</Label>
      <Input
        id="recipe-link"
        type="url"
        placeholder="https://"
        className="h-12 bg-white"
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor="servings">Servings</Label>
      <Input id="servings" type="number" defaultValue={4} className="w-24" />
    </div>
    <div className="flex gap-2">
      <Input placeholder="Search dinners" />
      <Button size="icon" aria-label="Search dinners">
        <Search />
      </Button>
    </div>
  </div>
);

export const WithDescriptionAndError = () => (
  <div className="max-w-sm space-y-4">
    <div className="space-y-2">
      <Label htmlFor="household-slug">Household slug</Label>
      <Input id="household-slug" defaultValue="the-hollunds" />
      <p className="text-muted-foreground text-sm">
        The slug is part of the URL for your household invitations.
      </p>
    </div>
    <div className="space-y-2">
      <Label htmlFor="short-slug" className="text-destructive">
        Household slug
      </Label>
      <Input id="short-slug" defaultValue="th" aria-invalid />
      <p className="text-destructive text-sm font-medium">
        Slug must be at least 3 characters
      </p>
    </div>
  </div>
);

export const Disabled = () => (
  <div className="max-w-sm space-y-4">
    <div className="space-y-2">
      <Label htmlFor="importing-link">Recipe link</Label>
      <Input
        id="importing-link"
        type="url"
        defaultValue="https://matprat.no/oppskrifter/fiskesuppe"
        disabled
      />
    </div>
    <Button disabled>
      <Wand2 />
      Importing…
    </Button>
  </div>
);
