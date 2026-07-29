---
category: Navigation
---

# Sidebar

The app's collapsible navigation rail. Everything in this family must sit
inside a `SidebarProvider`, which owns the open/collapsed state and the
keyboard shortcut — without it the parts render unstyled or throw.

```jsx
<SidebarProvider>
  <Sidebar>
    <SidebarHeader>PlanEatRepeat</SidebarHeader>
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>Plan</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton isActive>
                <CalendarDays />
                <span>This week</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton>
                <UtensilsCrossed />
                <span>Dinners</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
    <SidebarFooter>
      <UserAvatar />
    </SidebarFooter>
  </Sidebar>
  <SidebarInset>
    <SidebarTrigger />
    <PageContent />
  </SidebarInset>
</SidebarProvider>
```

`Sidebar` props: `side` (`left`/`right`), `variant`
(`sidebar`/`floating`/`inset`), `collapsible`
(`offcanvas`/`icon`/`none`). The sidebar has its own colour tokens —
`bg-sidebar`, `text-sidebar-foreground`, `border-sidebar-border` — which
are warmer than the page surface; use those inside it rather than the
regular `bg-background` family.
