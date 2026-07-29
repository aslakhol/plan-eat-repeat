---
category: Overlays
---

# Drawer

A bottom sheet with a drag handle, built on Vaul. This is the mobile half
of the app's `ResponsiveModal` pattern — a `Dialog` on desktop, a `Drawer`
below `sm`.

```jsx
<Drawer>
  <DrawerTrigger asChild><Button>Plan dinner</Button></DrawerTrigger>
  <DrawerContent>
    <DrawerHeader>
      <DrawerTitle>Plan dinner</DrawerTitle>
      <DrawerDescription>Pick something for Tuesday.</DrawerDescription>
    </DrawerHeader>
    <DinnerPicker />
    <DrawerFooter>
      <Button>Save</Button>
      <DrawerClose asChild><Button variant="outline">Cancel</Button></DrawerClose>
    </DrawerFooter>
  </DrawerContent>
</Drawer>
```

`DrawerContent` draws its own grab handle at the top.
