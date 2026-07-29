---
category: Forms
---

# Form

The react-hook-form binding layer. `Form` is the provider; `FormField`
connects one field to the form state and supplies the render props.

```jsx
<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
    <FormField
      control={form.control}
      name="name"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Household name</FormLabel>
          <FormControl>
            <Input placeholder="The Hollunds" {...field} />
          </FormControl>
          <FormDescription>Shown to everyone you invite.</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
    <Button type="submit">Save</Button>
  </form>
</Form>
```

`FormMessage` renders the validation error for its field and nothing when
the field is valid — always include it.
