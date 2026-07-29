---
category: Forms
---

# Select

A dropdown built on Radix Select. `Select` is the stateful root; the
trigger shows the current value and the content holds the options.

```jsx
<Select defaultValue="dinner">
  <SelectTrigger className="w-48">
    <SelectValue placeholder="Pick a meal" />
  </SelectTrigger>
  <SelectContent>
    <SelectGroup>
      <SelectLabel>Meals</SelectLabel>
      <SelectItem value="breakfast">Breakfast</SelectItem>
      <SelectItem value="dinner">Dinner</SelectItem>
    </SelectGroup>
  </SelectContent>
</Select>
```

Use `defaultValue` for an uncontrolled select, or `value` + `onValueChange`
to control it. The trigger has no width of its own — set one.
