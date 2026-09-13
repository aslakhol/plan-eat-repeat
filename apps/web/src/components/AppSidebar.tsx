import {
  Bot,
  Calendar,
  Plus,
  Settings,
  ShoppingBasket,
  UtensilsCrossed,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarTrigger,
} from "src/components/ui/sidebar";
import Link from "next/link";
import { useRouter } from "next/router";
import { api } from "~/utils/api";

const items = [
  {
    title: "Plan",
    url: "/",
    icon: Calendar,
  },
  {
    title: "Dinners",
    url: "/dinners",
    icon: UtensilsCrossed,
  },
  {
    title: "Shopping list",
    url: "/shopping-list",
    icon: ShoppingBasket,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
];

export function AppSidebar({ onAddDinner }: { onAddDinner: () => void }) {
  const router = useRouter();
  const { data: access } = api.aiImportSpend.access.useQuery();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Plan Eat Repeat</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Add Dinner"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                  onClick={onAddDinner}
                >
                  <Plus />
                  <span>Add Dinner</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {items.map((item) => {
                const isActive =
                  item.url === "/"
                    ? router.pathname === "/"
                    : router.pathname === item.url ||
                      router.pathname.startsWith(`${item.url}/`);

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                    >
                      <Link
                        href={item.url}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              {access?.isSystemAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={router.pathname.startsWith("/system-admin")}
                    tooltip="AI dashboard"
                  >
                    <Link href="/system-admin/ai-import-spend">
                      <Bot />
                      <span>AI dashboard</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
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
  );
}
