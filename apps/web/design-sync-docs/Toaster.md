---
category: Feedback
---

# Toaster

Mounts the toast viewport. Render it once near the root of the app; every
`toast()` call then renders through it. Takes no props.

```jsx
<>
  <AppContent />
  <Toaster />
</>
```

Trigger toasts imperatively rather than rendering `Toast` yourself:

```jsx
toast({ title: "Dinner saved", description: "Added to this week's plan." })
toast({ title: "Could not save", variant: "destructive" })
```
