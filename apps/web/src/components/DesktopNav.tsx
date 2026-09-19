import { Plus, Settings, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";
import { ShoppingItemCreationTrigger } from "~/views/ShoppingList/ShoppingItemCreationContext";

const items = [
  { title: "Plan", href: "/" },
  { title: "Cookbook", href: "/dinners" },
  { title: "Shopping list", href: "/shopping-list" },
];

export function DesktopNav({ onAddDinner }: { onAddDinner: () => void }) {
  const { pathname } = useRouter();
  const { data: access } = api.aiImportSpend.access.useQuery();
  const isShopping =
    pathname === "/shopping-list" || pathname === "/shopping-list/usually-have";
  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);
  const links = access?.isSystemAdmin
    ? [
        ...items,
        { title: "AI dashboard", href: "/system-admin/ai-import-spend" },
      ]
    : items;
  const addButton = (
    <button
      type="button"
      onClick={isShopping ? undefined : onAddDinner}
      className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring inline-flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
    >
      <Plus aria-hidden="true" className="size-[18px]" />
      {isShopping ? "Add item" : "Add Dinner"}
    </button>
  );

  return (
    <nav
      aria-label="Primary navigation"
      className="bg-sidebar border-sidebar-border hidden h-[60px] grid-cols-[minmax(32px,1fr)_minmax(0,672px)_minmax(32px,1fr)] items-center gap-x-4 border-b px-6 md:grid"
    >
      <div
        className="text-foreground whitespace-nowrap font-serif text-base"
        role="img"
        aria-label="Plan Eat Repeat"
      >
        <span className="hidden min-[1100px]:inline">Plan Eat Repeat</span>
        <UtensilsCrossed
          aria-hidden="true"
          className="text-primary size-6 min-[1100px]:hidden"
        />
      </div>
      <div className="flex min-w-0 items-center justify-between gap-4">
        <div className="flex items-center gap-[22px]">
          {links.map(({ title, href }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={cn(
                "text-muted-foreground hover:text-foreground focus-visible:ring-ring -mb-[5px] whitespace-nowrap border-b-2 border-transparent pb-[3px] text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                isActive(href) && "border-primary text-foreground font-bold",
              )}
            >
              {title}
            </Link>
          ))}
        </div>
        {isShopping ? (
          <ShoppingItemCreationTrigger>{addButton}</ShoppingItemCreationTrigger>
        ) : (
          addButton
        )}
      </div>
      <Link
        href="/settings"
        aria-label="Settings"
        aria-current={isActive("/settings") ? "page" : undefined}
        className={cn(
          "text-muted-foreground hover:text-foreground focus-visible:ring-ring flex size-8 items-center justify-center justify-self-end rounded-md outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          isActive("/settings") && "text-foreground",
        )}
      >
        <Settings aria-hidden="true" className="size-5" />
      </Link>
    </nav>
  );
}
