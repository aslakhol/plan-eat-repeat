import * as React from "react";
import { Button } from "@planeatrepeat/web";
import { Plus, Trash2, Loader2 } from "lucide-react";

export const Variants = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button>Add dinner</Button>
    <Button variant="secondary">Cancel</Button>
    <Button variant="outline">Edit</Button>
    <Button variant="ghost">Skip</Button>
    <Button variant="link">Learn more</Button>
    <Button variant="destructive">Delete</Button>
  </div>
);

export const Sizes = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button size="sm">Small</Button>
    <Button size="default">Default</Button>
    <Button size="lg">Large</Button>
    <Button size="icon" aria-label="Add dinner">
      <Plus />
    </Button>
  </div>
);

export const WithIcons = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button>
      <Plus />
      Add dinner
    </Button>
    <Button variant="outline">
      <Loader2 className="animate-spin" />
      Importing…
    </Button>
    <Button variant="destructive">
      <Trash2 />
      Delete dinner
    </Button>
  </div>
);

export const Disabled = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button disabled>Add dinner</Button>
    <Button variant="secondary" disabled>
      Cancel
    </Button>
    <Button variant="outline" disabled>
      Edit
    </Button>
  </div>
);
