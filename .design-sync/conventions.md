# Building with the PlanEatRepeat design system

A warm, domestic UI for a dinner-planning app. Terracotta primary on warm
off-white ("Warm Stone"), generous 0.75rem corners, Quicksand for text and
Young Serif for display headings.

## Setup

No root provider is needed for styling. `styles.css` defines every theme token
on `:root`, so components are correctly styled as soon as it is loaded. Three
components do require a wrapper, and render blank or throw without it:

- **`SidebarProvider`** — required ancestor of every `Sidebar*` component.
- **`TooltipProvider`** — required ancestor of every `Tooltip*` component. Mount
  one high in the tree, not one per tooltip.
- **`Toaster`** — mount once near the root; `toast({ title, description })` then
  renders through it. Do not render `Toast` directly in app code.

Dark mode is class-based: put `class="dark"` on an ancestor (usually `<html>`).

## Styling: Tailwind utilities, semantic tokens only

Style with Tailwind utility classes. **Always reach for the semantic token
names below rather than raw palette colours** (`bg-stone-100`, `text-red-500`)
— the semantic names are what carry the brand and what dark mode re-maps. Raw
palettes exist in the stylesheet as an escape hatch, but a design built from
them is off-brand and will not invert correctly.

| Family | Names |
|---|---|
| Page | `bg-background` `text-foreground` |
| Surfaces | `bg-card` `text-card-foreground` `bg-popover` `text-popover-foreground` |
| Brand | `bg-primary` `text-primary-foreground` (terracotta) |
| Quiet fills | `bg-secondary` `text-secondary-foreground` `bg-muted` `text-muted-foreground` |
| Hover / highlight | `bg-accent` `text-accent-foreground` |
| Danger | `bg-destructive` `text-destructive-foreground` |
| Lines & focus | `border-border` `border-input` `ring-ring` |
| Sidebar (warmer, use inside `Sidebar` only) | `bg-sidebar` `text-sidebar-foreground` `bg-sidebar-accent` `text-sidebar-accent-foreground` `border-sidebar-border` `bg-sidebar-primary` |

All of these take opacity modifiers — `hover:bg-accent/50`, `border-primary/50`
— which is how the app builds its hover states.

Radius: `rounded-lg` is the brand radius (0.75rem); `rounded-md` and
`rounded-sm` step down from it. Type: `font-sans` (Quicksand) is the default;
`font-serif` (Young Serif) is for display — dinner names, card titles, page
headings. Everything else is stock Tailwind v3 (`flex`, `grid`, `gap-*`,
`p-*`, `space-y-*`, `text-sm`, `sm:`/`md:`/`lg:`, `hover:`, `focus-visible:`).

**Arbitrary values in square brackets do not work.** The stylesheet is
pre-compiled and shipped, so there is no build step to generate a class like
`w-[380px]` or `text-[13px]` on demand — it produces no CSS at all and fails
silently, leaving the element unstyled in that dimension. Use the named scale
(`w-96`, `text-sm`), or, when you genuinely need an exact one-off value, an
inline `style={{ width: 380 }}`, which needs no stylesheet support.

## Where the truth lives

Read `_ds/<folder>/styles.css` and the files it `@import`s — that is the real,
complete utility and token surface, and it beats any summary here. Per
component, `<Name>.prompt.md` has a hand-written description and a worked
example, and `<Name>.d.ts` has the exact props.

## Idiomatic example

Library components for the controls; Tailwind utilities for your own layout glue.

```jsx
<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
  {dinners.map((dinner) => (
    <Card
      key={dinner.id}
      className="hover:bg-accent/50 flex h-full min-h-[100px] cursor-pointer flex-col justify-between transition-colors"
    >
      <CardHeader className="p-4 pb-2">
        <CardTitle className="line-clamp-2 font-serif text-base font-medium leading-tight sm:text-lg">
          {dinner.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        <div className="flex flex-wrap gap-1">
          {dinner.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  ))}
</div>
```

Note the two habits worth copying: `Card`'s default padding is generous, so
dense grids tighten it with `p-4 pb-2`; and interactive cards get
`hover:bg-accent/50 cursor-pointer transition-colors` rather than a new variant.
