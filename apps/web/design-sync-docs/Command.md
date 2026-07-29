---
category: Navigation
---

# Command

A filterable command palette / searchable list built on cmdk. Used inside
`FancyCombobox` here, and usable on its own for quick-switchers.

```jsx
<Command>
  <CommandInput placeholder="Search dinners…" />
  <CommandList>
    <CommandEmpty>No dinners found.</CommandEmpty>
    <CommandGroup heading="This week">
      <CommandItem>Tomato pasta</CommandItem>
      <CommandItem>
        Tacos
        <CommandShortcut>⌘T</CommandShortcut>
      </CommandItem>
    </CommandGroup>
  </CommandList>
</Command>
```

Filtering is automatic from the item text. Give `Command` a border and a
width when using it inline — on its own it is unstyled chrome.
