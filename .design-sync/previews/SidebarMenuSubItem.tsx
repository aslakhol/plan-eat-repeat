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
import { ChevronDown, UtensilsCrossed } from "lucide-react";

// SidebarMenuSubItem is the bare <li> for one nested row. It carries no styling
// of its own, so it is only legible as the list rows inside SidebarMenuSub.
export const NestedRows = () => (
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
                  <span>Vegetarian</span>
                  <ChevronDown className="ml-auto" />
                </SidebarMenuButton>
                <SidebarMenuSub>
                  {[
                    "Tomato pasta",
                    "Lentil soup",
                    "Halloumi wraps",
                    "Green salad",
                  ].map((dinner, i) => (
                    <SidebarMenuSubItem key={dinner}>
                      <SidebarMenuSubButton isActive={i === 1}>
                        <span>{dinner}</span>
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
