import { Home } from "lucide-react";

import {
  Card,
  CardTitle,
  CardHeader,
  CardContent,
  CardFooter,
  CardDescription,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import Link from "next/link";
import { type Household } from "@prisma/client";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "../../components/ui/avatar";
import { api } from "../../utils/api";

type Props = {
  household: Household;
};

export const AlreadyInHousehold = ({ household }: Props) => {
  const members = api.household.members.useQuery({ householdId: household.id });

  return (
    <div className="container mx-auto flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Already a Member</CardTitle>
          <CardDescription>
            You&apos;re already part of the {household.name} household
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="mb-2 text-lg font-semibold">Household Members</h3>
            <ul className="space-y-2">
              {members.data?.members.map((member) => (
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
                  <span className="text-sm capitalize text-muted-foreground">
                    {member.role.toLowerCase()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button asChild>
            <Link href="/settings/household">
              <Home className="mr-2 h-4 w-4" />
              Go to Household Settings
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};
