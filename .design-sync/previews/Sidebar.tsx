import * as React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
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

// The whole family needs a SidebarProvider ancestor, so every story here is a
// full shell. `collapsible="none"` keeps the panel in flow (the default
// off-canvas panel is `position: fixed`, which a small card cannot frame).
export const AppShell = () => (
  <SidebarProvider
    style={{ minHeight: 0, height: 384 }}
    className="w-full overflow-hidden rounded-lg border"
  >
    <Sidebar
      collapsible="none"
      className="border-sidebar-border h-full border-r"
    >
      <SidebarHeader className="px-3 py-3">
        <span className="font-serif text-base">PlanEatRepeat</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Hollund household</SidebarGroupLabel>
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
      <SidebarFooter>
        <div className="flex w-full p-2">
          <SidebarTrigger />
        </div>
      </SidebarFooter>
    </Sidebar>
    <SidebarInset className="p-6">
      <h2 className="font-serif text-xl">This week</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Wednesday 15 May — Tomato pasta
      </p>
    </SidebarInset>
  </SidebarProvider>
);

// `side="right"` mirrors the panel; the app keeps the border on the inner edge.
export const RightSide = () => (
  <SidebarProvider
    style={{ minHeight: 0, height: 320 }}
    className="w-full overflow-hidden rounded-lg border"
  >
    <SidebarInset className="p-6">
      <h2 className="font-serif text-xl">Fish tacos</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Planned for Friday 17 May
      </p>
    </SidebarInset>
    <Sidebar
      side="right"
      collapsible="none"
      className="border-sidebar-border h-full border-l"
    >
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Up next</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {["Fish tacos", "Chicken curry with rice", "Tomato pasta"].map(
                (dinner, i) => (
                  <SidebarMenuItem key={dinner}>
                    <SidebarMenuButton isActive={i === 0}>
                      <UtensilsCrossed />
                      <span>{dinner}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ),
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  </SidebarProvider>
);
