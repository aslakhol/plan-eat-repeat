import * as React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
} from "@planeatrepeat/web";
import { CalendarDays, Plus, Settings, UtensilsCrossed, Users } from "lucide-react";

// A group is one titled block inside SidebarContent. Two of them show the
// spacing the group owns; both need the provider + Sidebar above them.
export const TwoGroups = () => (
  <SidebarProvider style={{ minHeight: 0 }} className="w-auto">
    <Sidebar
      collapsible="none"
      style={{ height: 320 }}
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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator />
        <SidebarGroup>
          <SidebarGroupLabel>Household</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <Users />
                  <span>Members</span>
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

// SidebarGroup is `relative`, which is what lets SidebarGroupAction pin itself
// to the group's top-right corner.
export const WithAction = () => (
  <SidebarProvider style={{ minHeight: 0 }} className="w-auto">
    <Sidebar
      collapsible="none"
      style={{ height: 256 }}
      className="border-sidebar-border w-64 overflow-hidden rounded-lg border"
    >
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Dinners</SidebarGroupLabel>
          <SidebarGroupAction title="New dinner">
            <Plus />
          </SidebarGroupAction>
          <SidebarGroupContent>
            <SidebarMenu>
              {["Tomato pasta", "Fish tacos", "Chicken curry with rice"].map(
                (dinner) => (
                  <SidebarMenuItem key={dinner}>
                    <SidebarMenuButton>
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
