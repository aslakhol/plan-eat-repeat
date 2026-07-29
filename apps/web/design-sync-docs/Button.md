---
category: Actions
---

# Button

The primary action control. Renders a `<button>`, or wraps an arbitrary child
when `asChild` is set (use that to make a `next/link` look like a button).

```jsx
<div className="flex items-center gap-2">
  <Button>Add dinner</Button>
  <Button variant="secondary">Cancel</Button>
  <Button variant="outline" size="sm">Edit</Button>
  <Button variant="destructive">Delete</Button>
  <Button variant="ghost" size="icon"><Plus className="h-4 w-4" /></Button>
</div>
```

- `variant`: `default` (terracotta primary) · `secondary` · `outline` · `ghost` · `link` · `destructive`
- `size`: `default` (h-10) · `sm` (h-9) · `lg` (h-11) · `icon` (square, h-10 w-10)
- An `svg` child is auto-sized to `h-4 w-4`; no need to size icons yourself.
- `disabled` dims to 50% opacity and blocks pointer events.
