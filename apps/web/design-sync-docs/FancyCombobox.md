---
category: Forms
---

# FancyCombobox

A searchable, creatable multi-select built on `Command` — this app uses it for
dinner tags. Unlike the other components here it is app-specific rather than a
generic shadcn primitive.

It is **fully controlled**: it holds no selection state of its own, and every
mutation goes back to you through a callback. Options and selections are
`{ value, label }` objects, not strings.

```jsx
<FancyCombobox
  placeholder="Add tag…"
  options={allTags}                      // {value,label}[] — the full vocabulary
  selected={selectedTags}                // {value,label}[] — current selection
  select={(option) => setSelectedTags([...selectedTags, option])}
  unselect={(option) =>
    setSelectedTags(selectedTags.filter((t) => t.value !== option.value))
  }
  removeLast={() => setSelectedTags(selectedTags.slice(0, -1))}
  createNew={(value) => setSelectedTags([...selectedTags, { value, label: value }])}
/>
```

- `select` / `unselect` receive the whole option object.
- `removeLast` fires on Backspace in an empty input — the usual chip-deletion
  gesture. It takes no argument.
- `createNew` receives the raw typed string when the user commits a value that
  is not already in `options`; that is what makes new tags possible.
- Already-selected options are filtered out of the dropdown automatically.

Selected values render as removable `Badge`s inside the input box. The dropdown
opens on focus — there is no `open` prop — and its list is capped at
`max-h-[35dvh]`, so long vocabularies scroll.
