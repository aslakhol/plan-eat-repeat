import { SignOutButton, useClerk } from "@clerk/nextjs";
import { BottomNav } from "../BottomNav";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";
import Link from "next/link";

export const SettingsView = () => {
  const { openUserProfile, openOrganizationProfile } = useClerk();

  return (
    <div className="flex flex-col gap-4 p-4">
      <Button
        className={cn("justify-start")}
        variant={"outline"}
        onClick={() => openUserProfile()}
      >
        Account
      </Button>
      <Button
        className={cn("justify-start")}
        variant={"outline"}
        onClick={() => openOrganizationProfile()}
      >
        Organization
      </Button>
      <SignOutButton>
        <Button variant={"outline"} className={cn("justify-start")}>
          Sign out
        </Button>
      </SignOutButton>
      <BottomNav />
    </div>
  );
};
