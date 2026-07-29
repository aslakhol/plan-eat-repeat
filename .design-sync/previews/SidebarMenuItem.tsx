import * as React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@planeatrepeat/web";
import { CalendarDays, MoreHorizontal, Settings, UtensilsCrossed } from "lucide-react";

// SidebarMenuItem is the <li> wrapper: it is `relative` and opens the
// `group/menu-item` scope every row decoration hangs off. Rows only look right
// inside SidebarMenu, inside a Sidebar, inside the provider.
export const NavigationRows = () => (
  <SidebarProvider style={{ minHeight: 0 }} className="w-auto">
    <Sidebar
      collapsible="none"
      style={{ height: 240 }}
      className="border-sidebar-border w-64 overflow-hidden rounded-lg border"
    >
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Plan Eat Repeat</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive>
                  <CalendarDays />
                  <span>Plan</span>
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

// The item is also the positioning context for a badge or a row action — both
// absolutely position themselves against it.
export const WithBadgeAndAction = () => (
  <SidebarProvider style={{ minHeight: 0 }} className="w-auto">
    <Sidebar
      collapsible="none"
      style={{ height: 240 }}
      className="border-sidebar-border w-64 overflow-hidden rounded-lg border"
    >
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Dinners</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <UtensilsCrossed />
                  <span>Tomato pasta</span>
                </SidebarMenuButton>
                <SidebarMenuBadge>4</SidebarMenuBadge>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton isActive>
                  <UtensilsCrossed />
                  <span>Fish tacos</span>
                </SidebarMenuButton>
                <SidebarMenuAction title="More">
                  <MoreHorizontal />
                </SidebarMenuAction>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <UtensilsCrossed />
                  <span>Chicken curry with rice</span>
                </SidebarMenuButton>
                <SidebarMenuBadge>2</SidebarMenuBadge>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  </SidebarProvider>
);
