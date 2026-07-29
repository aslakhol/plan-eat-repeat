---
category: Surfaces
---

# Card

The main content container: white surface, `--radius` corners, hairline
border. Nearly every list item and settings panel in this app is a Card.

```jsx
<Card>
  <CardHeader>
    <CardTitle>Create household</CardTitle>
    <CardDescription>
      Invite the people you cook for. You can add more later.
    </CardDescription>
  </CardHeader>
  <CardContent>
    <HouseholdForm />
  </CardContent>
  <CardFooter className="justify-end">
    <Button>Save</Button>
  </CardFooter>
</Card>
```

Interactive cards in this app add
`className="hover:bg-accent/50 cursor-pointer transition-colors"`, and a
placeholder "add new" card uses `border-dashed bg-transparent`.
