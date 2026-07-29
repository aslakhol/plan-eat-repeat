import * as React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@planeatrepeat/web";
import { CalendarDays, ChefHat, Settings, UtensilsCrossed } from "lucide-react";

// The label is the small, dimmed heading over a group's rows. It reads as a
// label only in place, so the preview is the group it titles.
export const PlanGroup = () => (
  <SidebarProvider style={{ minHeight: 0 }} className="w-auto">
    <Sidebar
      collapsible="none"
      style={{ height: 240 }}
      className="border-sidebar-border w-64 overflow-hidden rounded-lg border"
    >
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
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <Settings />
                  <span>Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  </SidebarProvider>
);

// The label accepts an icon child (auto-sized to 16px) and `asChild` when the
// heading itself should be the clickable element.
export const WithIcon = () => (
  <SidebarProvider style={{ minHeight: 0 }} className="w-auto">
    <Sidebar
      collapsible="none"
      style={{ height: 240 }}
      className="border-sidebar-border w-64 overflow-hidden rounded-lg border"
    >
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            <ChefHat />
            <span className="ml-2">Hollund household</span>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {["Tomato pasta", "Fish tacos"].map((dinner) => (
                <SidebarMenuItem key={dinner}>
                  <SidebarMenuButton>
                    <UtensilsCrossed />
                    <span>{dinner}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  </SidebarProvider>
);
