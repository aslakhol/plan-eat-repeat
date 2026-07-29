---
category: Data Display
---

# Avatar

A circular user image with a text fallback shown while the image loads or
when it fails. Always render both children.

```jsx
<Avatar>
  <AvatarImage src={user.imageUrl} alt={user.name} />
  <AvatarFallback>AH</AvatarFallback>
</Avatar>
```

Default size is `h-10 w-10`; override with `className="h-8 w-8"` for dense rows.
