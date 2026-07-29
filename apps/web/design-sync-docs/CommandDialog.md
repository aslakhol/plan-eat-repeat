---
category: Navigation
---

# CommandDialog

A `Command` palette pre-wrapped in a `Dialog` — the ⌘K pattern.

```jsx
<CommandDialog open={open} onOpenChange={setOpen}>
  <CommandInput placeholder="Jump to…" />
  <CommandList>
    <CommandEmpty>Nothing matches.</CommandEmpty>
    <CommandGroup heading="Pages">
      <CommandItem>Dinners</CommandItem>
      <CommandItem>This week</CommandItem>
    </CommandGroup>
  </CommandList>
</CommandDialog>
```

Controlled only — wire `open` and `onOpenChange` yourself.
