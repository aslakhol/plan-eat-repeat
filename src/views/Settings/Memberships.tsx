import {
  type MembershipRole,
  type Household,
  type Membership,
} from "@prisma/client";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "../../components/ui/avatar";
import { api } from "../../utils/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { toast } from "../../components/ui/use-toast";
import { useClerk } from "@clerk/nextjs";
import {
  Card,
  CardTitle,
  CardContent,
  CardHeader,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { X } from "lucide-react";
import { useState } from "react";

type Props = { household: Household };

export const Memberships = ({ household }: Props) => {
  const { user } = useClerk();
  const membersQuery = api.household.members.useQuery({
    householdId: household.id,
  });
  const userIsAdmin = !!membersQuery.data?.members.some(
    (member) => member.userId === user?.id && member.role === "ADMIN",
  );

  const handleRemoveMember = (memberId: number) => {
    // removeMemberMutation.mutate({ memberId });
    console.log("remove member", memberId);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Members</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          {membersQuery.data?.members.map((member) => (
            <li key={member.id} className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
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
              <div className="flex items-center space-x-2">
                <Role
                  member={member}
                  household={household}
                  userIsAdmin={userIsAdmin}
                />
                <Button
                  variant="destructive"
                  onClick={() => handleRemoveMember(member.id)}
                >
                  <X className="h-4 w-4" />
                  <span className="">Remove member</span>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};

type RoleProps = {
  member: Membership;
  household: Household;
  userIsAdmin: boolean;
};

const Role = ({ member, household, userIsAdmin }: RoleProps) => {
  const [role, setRole] = useState<MembershipRole>(member.role);
  const utils = api.useUtils();
  const updateRoleMutation = api.household.updateMemberRole.useMutation({
    onSuccess: () => {
      void utils.household.members.invalidate();
      toast({
        title: "Role updated",
        description: "Member role has been updated successfully",
      });
    },
    onError: (error) => {
      void utils.household.members.invalidate();
      setRole(member.role);
      toast({
        title: "Something went wrong",
        description: error.message,
      });
    },
  });

  const handleRoleChange = (memberId: number, newRole: MembershipRole) => {
    updateRoleMutation.mutate({
      memberId,
      role: newRole,
      householdId: household.id,
    });
  };

  return (
    <Select
      value={role}
      onValueChange={(value: MembershipRole) => {
        setRole(value);
        handleRoleChange(member.id, value);
      }}
      disabled={!userIsAdmin}
    >
      <SelectTrigger className="ml-auto w-[120px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ADMIN">Admin</SelectItem>
        <SelectItem value="MEMBER">Member</SelectItem>
      </SelectContent>
    </Select>
  );
};

// Update role mutation so that there is always one admin
// disable remove button if user is not admin
// change text to leave household if member is self
// make remove member mutation