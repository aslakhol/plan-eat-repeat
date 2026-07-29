import * as React from "react";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
} from "@planeatrepeat/web";

// `open` is set so the panel renders in the card. DialogContent portals to
// document.body, so the trigger is what keeps the card root non-empty.
export const Open = () => (
  <Dialog open>
    <DialogTrigger asChild>
      <Button variant="outline">Edit dinner</Button>
    </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Edit dinner</DialogTitle>
        <DialogDescription>
          Change the name, tags or notes for this dinner.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <Label htmlFor="dinner-name">Name</Label>
        <Input id="dinner-name" defaultValue="Tomato pasta" />
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary">Cancel</Button>
        </DialogClose>
        <Button>Save dinner</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
