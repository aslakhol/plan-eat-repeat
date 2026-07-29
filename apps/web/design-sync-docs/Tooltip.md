---
category: Overlays
---

# Tooltip

A hover/focus label. Every tooltip must sit inside a `TooltipProvider` —
mount one high in the tree rather than per tooltip.

```jsx
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="ghost" size="icon"><Info className="h-4 w-4" /></Button>
    </TooltipTrigger>
    <TooltipContent>Dinners you have not cooked recently</TooltipContent>
  </Tooltip>
</TooltipProvider>
```

Tooltips are hover-only — never put an action or essential text in one.
