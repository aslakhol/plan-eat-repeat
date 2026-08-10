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

  const navClass =
    "flex h-full min-w-0 flex-1 items-center justify-center text-[15px] font-bold text-muted-foreground transition-colors hover:text-primary";
  const activeClass = "text-primary";

  return (
    <nav
      aria-label="Primary navigation"
      className="bg-background/95 supports-[backdrop-filter]:bg-background/80 fixed bottom-0 left-0 right-0 z-40 h-[72px] border-t pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <div className="mx-auto grid h-full w-full max-w-lg grid-cols-[1fr_76px_1fr] items-center px-3">
        <Link
          href="/"
          className={cn(navClass, router.asPath === "/" && activeClass)}
          aria-current={router.asPath === "/" ? "page" : undefined}
          onClick={onClick}
        >
          Week
        </Link>

        <button
          type="button"
          aria-label="Add Dinner"
          className="bg-primary text-primary-foreground focus-visible:ring-ring relative -top-5 mx-auto flex size-[64px] items-center justify-center rounded-full text-[40px] font-light leading-none shadow-[0_6px_18px_rgba(194,85,47,0.3)] transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          onClick={onAddDinner}
        >
          <span aria-hidden="true" className="-translate-y-0.5">
            +
          </span>
        </button>

        <Link
          href="/dinners"
          className={cn(
            navClass,
            router.asPath.startsWith("/dinners") && activeClass,
          )}
          aria-current={
            router.asPath.startsWith("/dinners") ? "page" : undefined
          }
          onClick={onClick}
        >
          Cookbook
        </Link>
      </div>
    </nav>
  );
};
