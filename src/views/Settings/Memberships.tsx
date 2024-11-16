import { type MembershipRole, type Household } from "@prisma/client";
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

type Props = { household: Household };

export const Memberships = ({ household }: Props) => {
  const { user } = useClerk();
  const utils = api.useUtils();
  const membersQuery = api.household.members.useQuery({
    householdId: household.id,
  });
  const userIsAdmin = membersQuery.data?.members.some(
    (member) => member.userId === user?.id && member.role === "ADMIN",
  );

  const updateRoleMutation = api.household.updateMemberRole.useMutation({
    onSuccess: () => {
      void utils.household.members.invalidate();
      toast({
        title: "Role updated",
        description: "Member role has been updated successfully",
      });
    },
  });

  const handleRoleChange = (memberId: number, newRole: MembershipRole) => {
    updateRoleMutation.mutate({
      memberId,
      role: newRole,
    });
  };

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
                <Select
                  defaultValue={member.role}
                  onValueChange={(value: MembershipRole) =>
                    handleRoleChange(member.id, value)
                  }
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
