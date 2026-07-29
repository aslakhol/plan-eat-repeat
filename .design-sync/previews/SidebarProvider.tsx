import * as React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@planeatrepeat/web";
import { CalendarDays, Settings, UtensilsCrossed } from "lucide-react";

const nav = [
  { title: "Plan", icon: CalendarDays, active: true },
  { title: "Dinners", icon: UtensilsCrossed, active: false },
  { title: "Settings", icon: Settings, active: false },
];

const Nav = () => (
  <SidebarContent>
    <SidebarGroup>
      <SidebarGroupLabel>Plan Eat Repeat</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {nav.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton isActive={item.active}>
                <item.icon />
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  </SidebarContent>
);

// The provider owns open/collapsed state and hands every descendant the sidebar
// context. It renders the flex row that pairs the panel with SidebarInset, so
// the honest preview is the whole app layout.
export const AppLayout = () => (
  <SidebarProvider
    style={{ minHeight: 0, height: 320 }}
    className="w-full overflow-hidden rounded-lg border"
  >
    <Sidebar
      collapsible="none"
      className="border-sidebar-border h-full border-r"
    >
      <Nav />
    </Sidebar>
    <SidebarInset>
      <header className="flex items-center gap-2 border-b p-3">
        <SidebarTrigger />
        <span className="font-serif text-base">This week</span>
      </header>
      <div className="text-muted-foreground p-6 text-sm">
        Wednesday 15 May — Tomato pasta
      </div>
    </SidebarInset>
  </SidebarProvider>
);

// The provider publishes `--sidebar-width` on its wrapper, so a narrower rail
// is a style override on the provider rather than a prop on Sidebar.
export const CustomWidth = () => (
  <SidebarProvider
    style={{ "--sidebar-width": "13rem", minHeight: 0, height: 288 } as React.CSSProperties}
    className="w-full overflow-hidden rounded-lg border"
  >
    <Sidebar
      collapsible="none"
      className="border-sidebar-border h-full border-r"
    >
      <Nav />
    </Sidebar>
    <SidebarInset className="p-6">
      <p className="text-muted-foreground text-sm">
        A 13rem rail leaves more room for the week grid.
      </p>
    </SidebarInset>
  </SidebarProvider>
);
