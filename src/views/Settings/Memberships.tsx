import {
  type MembershipRole,
  type Household,
  type Membership,
  type User,
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
import { DoorOpen } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogFooter,
  DialogDescription,
  DialogTitle,
  DialogHeader,
  DialogContent,
  DialogTrigger,
} from "../../components/ui/dialog";

type Props = { household: Household };

export const Memberships = ({ household }: Props) => {
  const { user } = useClerk();
  const membersQuery = api.household.members.useQuery({
    householdId: household.id,
  });
  const userIsAdmin = !!membersQuery.data?.members.some(
    (member) => member.userId === user?.id && member.role === "ADMIN",
  );

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
                {userIsAdmin && (
                  <RemoveMember
                    member={member}
                    household={household}
                    userIsAdmin={userIsAdmin}
                  />
                )}
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

type RemoveMemberProps = {
  member: Membership & { user: User };
  household: Household;
  userIsAdmin: boolean;
};

const RemoveMember = ({ member, household }: RemoveMemberProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const utils = api.useUtils();
  const { user, signOut } = useClerk();
  const isSelf = member.userId === user?.id;
  const removeMemberMutation = api.household.removeMember.useMutation({
    onSuccess: () => {
      void utils.household.members.invalidate();
      if (isSelf) {
        void signOut();
      }
      setDialogOpen(false);
    },
  });

  const handleRemoveMember = (memberId: number) => {
    removeMemberMutation.mutate({ memberId, householdId: household.id });
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="icon">
          <DoorOpen className="h-4 w-4" />
          <span className="sr-only">Remove member</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isSelf ? "Leave Household" : "Remove Member"}
          </DialogTitle>
          <DialogDescription>
            {isSelf
              ? "Are you sure you want to remove yourself from this household? You will lose access and be logged out."
              : `Are you sure you want to remove ${member.user.firstName} ${member.user.lastName} from this household?`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => handleRemoveMember(member.id)}
          >
            {isSelf ? "Leave" : "Remove"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
