---
category: Overlays
---

# Dialog

A centred modal. Use it for focused tasks on desktop; for a layout that
adapts to mobile, prefer the app's `ResponsiveModal`, which swaps to
`Drawer` on small screens.

```jsx
<Dialog>
  <DialogTrigger asChild>
    <Button>Edit dinner</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Edit dinner</DialogTitle>
      <DialogDescription>Change the name, tags or notes.</DialogDescription>
    </DialogHeader>
    <DinnerForm />
    <DialogFooter>
      <DialogClose asChild><Button variant="secondary">Cancel</Button></DialogClose>
      <Button type="submit">Save</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

Control it with `open` + `onOpenChange`, or let the trigger manage it.
`DialogContent` already renders the overlay, portal and close button.
