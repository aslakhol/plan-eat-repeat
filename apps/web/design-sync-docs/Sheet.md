---
category: Overlays
---

# Sheet

A panel that slides in from an edge — good for filters, detail views and
secondary navigation.

```jsx
<Sheet>
  <SheetTrigger asChild><Button variant="outline">Filters</Button></SheetTrigger>
  <SheetContent side="right">
    <SheetHeader>
      <SheetTitle>Filter dinners</SheetTitle>
      <SheetDescription>Narrow the list by tag.</SheetDescription>
    </SheetHeader>
    <FilterControls />
    <SheetFooter>
      <Button>Apply</Button>
    </SheetFooter>
  </SheetContent>
</Sheet>
```

`side` on `SheetContent`: `right` (default) · `left` · `top` · `bottom`.
