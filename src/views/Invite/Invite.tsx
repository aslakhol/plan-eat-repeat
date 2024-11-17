import {
  type Household,
  Invite,
  type Membership,
  type User,
} from "@prisma/client";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "../../components/ui/avatar";
import { Button } from "../../components/ui/button";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { api, type RouterOutputs } from "../../utils/api";
import { UserPlus } from "lucide-react";

type Props = {
  invite: Invite & {
    household: Household & { Members: Array<Membership & { user: User }> };
  };
};

export const Invite = ({ invite }: Props) => {
  const utils = api.useUtils();

  const joinHouseholdMutation = api.household.join.useMutation({
    onSuccess: () => {
      void utils.household.members.invalidate({
        householdId: invite.householdId,
      });
      void utils.household.getInvite.invalidate({ inviteId: invite.id });

      toast({
        title: "You have joined the household",
        description: `Welcome to the ${invite.household.name} household!`,
      });
      router.push("/");
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
              {invite.household.Members.map((member) => (
                <li
                  key={member.id}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center space-x-2">
                    <Avatar>
                      <AvatarImage
                        src={`https://api.dicebear.com/9.x/thumbs/svg?flip=true&backgroundColor=c0aede&seed=${member.user.id}`}
                      />
                      <AvatarFallback>
                        {member.user.firstName?.slice(0, 1)}
                        {member.user.lastName?.slice(0, 1)}
                      </AvatarFallback>
                    </Avatar>
                    <span>
                      {member.user.firstName} {member.user.lastName}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {member.role}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            className="w-full"
            onClick={handleJoinHousehold}
            disabled={isJoining}
          >
            {isJoining ? (
              "Joining..."
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Join Household
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

// Make the mutation
// Ask v0 about no invite page
