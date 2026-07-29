import * as React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
} from "@planeatrepeat/web";
import { CalendarDays, ChevronsUpDown, Settings, UtensilsCrossed } from "lucide-react";

const nav = [
  { title: "Plan", icon: CalendarDays, active: true },
  { title: "Dinners", icon: UtensilsCrossed, active: false },
  { title: "Settings", icon: Settings, active: false },
];

const Rows = () => (
  <SidebarContent>
    <SidebarGroup>
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

// SidebarHeader is the pinned block above the scrolling content — the app puts
// the product wordmark there. It needs the provider + Sidebar around it.
export const Wordmark = () => (
  <SidebarProvider style={{ minHeight: 0 }} className="w-auto">
    <Sidebar
      collapsible="none"
      style={{ height: 320 }}
      className="border-sidebar-border w-64 overflow-hidden rounded-lg border"
    >
      <SidebarHeader className="px-3 py-3">
        <span className="font-serif text-base leading-none">PlanEatRepeat</span>
      </SidebarHeader>
      <SidebarSeparator />
      <Rows />
    </Sidebar>
  </SidebarProvider>
);

// The header also hosts the household switcher, built from a menu button so it
// picks up the sidebar accent on hover.
export const HouseholdSwitcher = () => (
  <SidebarProvider style={{ minHeight: 0 }} className="w-auto">
    <Sidebar
      collapsible="none"
      style={{ height: 320 }}
      className="border-sidebar-border w-64 overflow-hidden rounded-lg border"
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg">
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex size-8 items-center justify-center rounded-md">
                <UtensilsCrossed className="size-4" />
              </div>
              <div className="flex flex-1 flex-col text-left leading-tight">
                <span className="truncate text-sm font-medium">
                  Hollund household
                </span>
                <span className="text-sidebar-foreground/70 truncate text-xs">
                  4 members
                </span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <Rows />
    </Sidebar>
  </SidebarProvider>
);
