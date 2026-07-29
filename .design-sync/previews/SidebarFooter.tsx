import * as React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from "@planeatrepeat/web";
import { CalendarDays, LogOut, Settings, UtensilsCrossed } from "lucide-react";

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

// SidebarFooter pins to the bottom of the panel — SidebarContent takes the
// remaining height. This is the app's real footer: the collapse trigger.
export const CollapseTrigger = () => (
  <SidebarProvider style={{ minHeight: 0 }} className="w-auto">
    <Sidebar
      collapsible="none"
      style={{ height: 320 }}
      className="border-sidebar-border w-64 overflow-hidden rounded-lg border"
    >
      <Rows />
      <SidebarSeparator />
      <SidebarFooter>
        <div className="flex w-full p-2">
          <SidebarTrigger />
        </div>
      </SidebarFooter>
    </Sidebar>
  </SidebarProvider>
);

// A signed-in user block is the other common footer: an avatar row plus a way
// out, both styled from the sidebar tokens rather than the page surface.
export const UserBlock = () => (
  <SidebarProvider style={{ minHeight: 0 }} className="w-auto">
    <Sidebar
      collapsible="none"
      style={{ height: 320 }}
      className="border-sidebar-border w-64 overflow-hidden rounded-lg border"
    >
      <Rows />
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg">
              <div className="bg-sidebar-accent text-sidebar-accent-foreground flex size-8 items-center justify-center rounded-full text-xs font-medium">
                AH
              </div>
              <div className="flex flex-1 flex-col text-left leading-tight">
                <span className="truncate text-sm font-medium">Aslak</span>
                <span className="text-sidebar-foreground/70 truncate text-xs">
                  Hollund household
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton size="sm">
              <LogOut />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  </SidebarProvider>
);
