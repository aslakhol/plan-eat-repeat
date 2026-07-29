---
category: Data Display
---

# Badge

A small inline label — used in this app for dinner tags.

```jsx
<div className="flex flex-wrap gap-1">
  <Badge variant="secondary">Vegetarian</Badge>
  <Badge variant="outline">30 min</Badge>
  <Badge>Favourite</Badge>
</div>
```

- `variant`: `default` (primary fill) · `secondary` · `outline` · `destructive`
- Badges do not wrap their own text — keep labels to a word or two.
