import { Fragment } from "react";
import {
  Bookmark,
  Calendar,
  Plus,
  ShoppingCart,
  Settings,
} from "lucide-react";
import { useRouter } from "next/router";
import { cn } from "../lib/utils";
import Link from "next/link";
import { useClerk } from "@clerk/nextjs";

export const BottomNav = ({ onAddDinner }: { onAddDinner: () => void }) => {
  const router = useRouter();
  const { user } = useClerk();

  const onClick = !user?.publicMetadata.householdId
    ? async () => {
        await user?.reload();
        router.reload();
      }
    : undefined;

  const items = [
    { title: "Plan", url: "/", icon: Calendar },
    { title: "Cookbook", url: "/dinners", icon: Bookmark },
    { title: "Shopping list", url: "/shopping-list", icon: ShoppingCart },
    { title: "Settings", url: "/settings", icon: Settings },
  ];

  return (
    <nav
      aria-label="Primary navigation"
      className="bg-background/95 supports-[backdrop-filter]:bg-background/80 fixed bottom-0 left-0 right-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <div className="mx-auto grid h-16 w-full max-w-lg grid-cols-5 items-center px-3">
        {items.map((item) => {
          const isActive =
            item.url === "/"
              ? router.pathname === "/"
              : router.pathname === item.url ||
                router.pathname.startsWith(`${item.url}/`);

          return (
            <Fragment key={item.url}>
              <Link
                href={item.url}
                aria-label={item.title}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "text-muted-foreground hover:text-primary focus-visible:ring-ring flex h-full min-w-0 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2",
                  isActive && "text-primary",
                )}
                onClick={onClick}
              >
                <item.icon aria-hidden="true" className="size-6" />
              </Link>

              {item.url === "/dinners" && (
                <button
                  type="button"
                  aria-label="Add Dinner"
                  className="bg-primary text-primary-foreground focus-visible:ring-ring relative -top-3 mx-auto flex size-[52px] items-center justify-center rounded-full shadow-[0_6px_18px_rgba(194,85,47,0.3)] transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  onClick={onAddDinner}
                >
                  <Plus aria-hidden="true" className="size-7" />
                </button>
              )}
            </Fragment>
          );
        })}
      </div>
    </nav>
  );
};
