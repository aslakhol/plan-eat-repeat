import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignOutButton,
  useClerk,
} from "@clerk/nextjs";
import { BottomNav } from "../BottomNav";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";
import Link from "next/link";

export const SettingsView = () => {
  const { openUserProfile } = useClerk();

  return (
    <div className="min-h-screen max-w-xl border-r">
      <SignedIn>
        <div className="flex flex-col gap-4 p-4">
          <Button
            className={cn("justify-start")}
            variant={"outline"}
            onClick={() => openUserProfile()}
          >
            Account
          </Button>
          <Button className={cn("justify-start")} variant={"outline"} asChild>
            <Link href="/settings/household">Household</Link>
          </Button>

          <SignOutButton>
            <Button variant={"outline"} className={cn("justify-start")}>
              Sign out
            </Button>
          </SignOutButton>
        </div>
      </SignedIn>
      <SignedOut>
        <div className="flex flex-col gap-4 p-4">
          <SignInButton>
            <Button variant={"outline"} className={cn("justify-start")}>
              Sign in
            </Button>
          </SignInButton>
        </div>
      </SignedOut>
      <BottomNav />
    </div>
  );
};
