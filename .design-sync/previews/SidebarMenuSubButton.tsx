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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
} from "@planeatrepeat/web";
import { ChevronDown, Fish, Soup, UtensilsCrossed } from "lucide-react";

// The nested row itself: an <a> at 28px with the sidebar accent for hover and
// for `isActive`. It needs SidebarMenuSub above it for the indent guide.
export const ActiveAndDefault = () => (
  <SidebarProvider style={{ minHeight: 0 }} className="w-auto">
    <Sidebar
      collapsible="none"
      style={{ height: 288 }}
      className="border-sidebar-border w-64 overflow-hidden rounded-lg border"
    >
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Dinners</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive>
                  <UtensilsCrossed />
                  <span>Friday favourites</span>
                  <ChevronDown className="ml-auto" />
                </SidebarMenuButton>
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton isActive>
                      <Fish />
                      <span>Fish tacos</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton>
                      <Soup />
                      <span>Chicken curry with rice</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton>
                      <UtensilsCrossed />
                      <span>Tomato pasta</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  </SidebarProvider>
);

// `size="sm"` drops the row to 12px type — used when a sub-list gets long.
export const SmallSize = () => (
  <SidebarProvider style={{ minHeight: 0 }} className="w-auto">
    <Sidebar
      collapsible="none"
      style={{ height: 288 }}
      className="border-sidebar-border w-64 overflow-hidden rounded-lg border"
    >
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>This week</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <UtensilsCrossed />
                  <span>Planned dinners</span>
                </SidebarMenuButton>
                <SidebarMenuSub>
                  {[
                    "Mon — Tomato pasta",
                    "Tue — Lentil soup",
                    "Wed — Fish tacos",
                    "Thu — Halloumi wraps",
                    "Fri — Chicken curry",
                  ].map((row, i) => (
                    <SidebarMenuSubItem key={row}>
                      <SidebarMenuSubButton size="sm" isActive={i === 2}>
                        <span>{row}</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  </SidebarProvider>
);
