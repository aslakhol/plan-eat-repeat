import { type Household, type Invite } from "@prisma/client";
import { Button } from "../../components/ui/button";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { api } from "../../utils/api";
import { UserPlus } from "lucide-react";
import { toast } from "../../components/ui/use-toast";
import { useRouter } from "next/router";
import { SignedIn, SignedOut, SignUpButton, useClerk } from "@clerk/nextjs";
import { UserAvatar } from "../UserAvatar";

type Props = {
  invite: Invite & {
    household: Household;
  };
};

export const Invitation = ({ invite }: Props) => {
  const utils = api.useUtils();
  const { user } = useClerk();
  const router = useRouter();
  const membersQuery = api.household.members.useQuery({
    householdId: invite.householdId,
  });
  const joinHouseholdMutation = api.household.join.useMutation({
    onSuccess: async () => {
      await utils.household.members.invalidate({
        householdId: invite.householdId,
      });

      toast({
        title: "You have joined the household",
        description: `Welcome to the ${invite.household.name} household!`,
      });
      await user?.reload();
      await router.push("/dinners");
    },
  });

  const handleJoinHousehold = () => {
    joinHouseholdMutation.mutate({ inviteId: invite.id });
  };

  return (
    <div className="container mx-auto flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            Join {invite.household.name}
          </CardTitle>
          <CardDescription>
            You&apos;ve been invited to join the {invite.household.name}{" "}
            household
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="mb-2 text-lg font-semibold">Existing Members</h3>
            <ul className="space-y-2">
              {membersQuery.data?.members.map((member) => (
                <li
                  key={member.id}
                  className="flex items-center justify-between"
                >
                  <UserAvatar user={member.user} />
                  <span className="text-sm capitalize text-muted-foreground">
                    {member.role.toLowerCase()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
        <CardFooter>
          <SignedIn>
            <Button
              className="w-full"
              onClick={handleJoinHousehold}
              disabled={joinHouseholdMutation.isPending}
            >
              {joinHouseholdMutation.isPending ? (
                "Joining..."
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Join Household
                </>
              )}
            </Button>
          </SignedIn>
          <SignedOut>
            <SignUpButton>
              <Button className="w-full">Sign up to join</Button>
            </SignUpButton>
          </SignedOut>
        </CardFooter>
      </Card>
    </div>
  );
};
