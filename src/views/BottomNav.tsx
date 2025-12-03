import { useRouter } from "next/router";
import { Button } from "../components/ui/button";
import { cn } from "../lib/utils";
import Link from "next/link";
import { SignedIn, SignInButton, SignedOut, useClerk } from "@clerk/nextjs";
import { Calendar, Settings, UtensilsCrossed, LogIn } from "lucide-react";

export const BottomNav = () => {
  const router = useRouter();
  const { user } = useClerk();

  const onClick = !user?.publicMetadata.householdId
    ? async () => {
        await user?.reload();
        router.reload();
      }
    : undefined;

  const navClass =
    "flex flex-col items-center justify-center h-full w-full gap-1 text-xs font-medium text-muted-foreground hover:text-primary transition-colors";
  const activeClass = "text-primary";

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 h-16 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-full w-full items-center justify-around">
        <Link
          href="/"
          className={cn(navClass, router.asPath === "/" && activeClass)}
          onClick={onClick}
        >
          <Calendar className="h-5 w-5" />
          <span>Plan</span>
        </Link>
        
        <Link
          href="/dinners"
          className={cn(
            navClass,
            router.asPath.startsWith("/dinners") && activeClass
          )}
          onClick={onClick}
        >
          <UtensilsCrossed className="h-5 w-5" />
          <span>Dinners</span>
        </Link>

        <SignedOut>
          <SignInButton mode="modal">
            <button className={navClass}>
              <LogIn className="h-5 w-5" />
              <span>Sign in</span>
            </button>
          </SignInButton>
        </SignedOut>
        
        <SignedIn>
          <Link
            href="/settings"
            className={cn(
              navClass,
              router.asPath.startsWith("/settings") && activeClass
            )}
          >
            <Settings className="h-5 w-5" />
            <span>Settings</span>
          </Link>
        </SignedIn>
      </div>
    </div>
  );
};
