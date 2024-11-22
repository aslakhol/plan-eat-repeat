import { Settings, LogOut } from "lucide-react";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../../components/ui/card";
import { SignOutButton, useClerk } from "@clerk/nextjs";
import { BigUserAvatar } from "../UserAvatar";

export const Account = () => {
  const { user } = useClerk();
  const { openUserProfile } = useClerk();

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col space-y-4">
            {user && (
              <BigUserAvatar
                user={user}
                householdId={user?.publicMetadata.householdId ?? ""}
              />
            )}
            <div className="flex flex-col space-y-2 sm:flex-row sm:space-x-2 sm:space-y-0">
              <Button
                className="w-full sm:w-auto"
                variant="outline"
                onClick={() =>
                  openUserProfile({ routing: "path", path: "/security" })
                }
              >
                <Settings className="mr-2 h-4 w-4" />
                Account Settings
              </Button>
              <SignOutButton>
                <Button className="w-full sm:w-auto" variant="outline">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </Button>
              </SignOutButton>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
};
