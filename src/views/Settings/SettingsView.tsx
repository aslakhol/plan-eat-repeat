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
  const {
    openUserProfile,
    openOrganizationProfile,
    openCreateOrganization,
    organization,
  } = useClerk();

  return (
    <>
      <SignedIn>
        <div className="flex flex-col gap-4 p-4">
          <Button
            className={cn("justify-start")}
            variant={"outline"}
            onClick={() => openUserProfile()}
          >
            Account
          </Button>
          {organization ? (
            <Button
              className={cn("justify-start")}
              variant={"outline"}
              onClick={() => openOrganizationProfile()}
            >
              Household
            </Button>
          ) : (
            <Button
              className={cn("justify-start")}
              variant={"outline"}
              onClick={() => openCreateOrganization()}
            >
              Create household
            </Button>
          )}

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
    </>
  );
};
