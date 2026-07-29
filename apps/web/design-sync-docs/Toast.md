---
category: Feedback
---

# Toast

A single notification. In normal use you do not render this directly —
call `toast()` and let `Toaster` render it. Render it manually only when
you need a static, always-visible notification in a mockup.

```jsx
<Toast>
  <div className="grid gap-1">
    <ToastTitle>Dinner saved</ToastTitle>
    <ToastDescription>Added to this week's plan.</ToastDescription>
  </div>
  <ToastClose />
</Toast>
```

`variant`: `default` · `destructive`.
