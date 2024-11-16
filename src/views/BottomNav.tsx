import { useRouter } from "next/router";
import { Button } from "../components/ui/button";
import { cn } from "../lib/utils";
import Link from "next/link";
import { SignedIn, SignInButton, SignedOut } from "@clerk/nextjs";

export const BottomNav = () => {
  const router = useRouter();

  return (
    <div className="pb-20">
      <div className="fixed bottom-0 flex w-full justify-around border-t bg-white">
        <Button
          variant={"link"}
          className={cn(
            "w-full py-8 text-xl",
            router.asPath.startsWith("/") && "underline",
          )}
          asChild
        >
          <Link href="/">Plan</Link>
        </Button>
        <Button
          variant={"link"}
          className={cn(
            "w-full py-8 text-xl",
            router.asPath.startsWith("/dinners") && "underline",
          )}
          asChild
        >
          <Link href="/dinners">Dinners</Link>
        </Button>
        <SignedOut>
          <SignInButton mode="modal">
            <Button variant={"link"} className="w-full py-8 text-xl">
              Sign in
            </Button>
          </SignInButton>
        </SignedOut>
        <SignedIn>
          <Button
            variant={"link"}
            className={cn(
              "w-full py-8 text-xl",
              router.asPath.startsWith("/settings") && "underline",
            )}
            asChild
          >
            <Link href="/settings">Settings</Link>
          </Button>
        </SignedIn>
      </div>
    </div>
  );
};
