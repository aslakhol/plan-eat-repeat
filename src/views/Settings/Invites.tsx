import { Plus, Copy, X } from "lucide-react";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardTitle,
  CardHeader,
  CardContent,
} from "../../components/ui/card";
import { api } from "../../utils/api";
import { type Household } from "@prisma/client";
import { toast } from "../../components/ui/use-toast";

type Props = { household: Household };

export const Invites = ({ household }: Props) => {
  const utils = api.useUtils();
  const invitesQuery = api.household.invites.useQuery({
    householdId: household.id,
  });
  const createInviteMutation = api.household.createInvite.useMutation({
    onSuccess: () => {
      void utils.household.invites.invalidate();
    },
  });

  const handleCreateInvite = () => {
    createInviteMutation.mutate({ householdId: household.id });
  };

  const handleRemoveInvite = (inviteId: string) => {
    console.log("remove invite", inviteId);
  };

  const handleCopyInviteLink = (link: string) => {
    void navigator.clipboard.writeText(link);
    toast({
      title: "Invite link copied to clipboard",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invites</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Button onClick={handleCreateInvite}>
            <Plus className="mr-2 h-4 w-4" /> Create New Invite
          </Button>
          <ul className="space-y-2">
            {invitesQuery.data?.invites.map((invite) => (
              <li key={invite.id} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {invite.link}
                </span>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleCopyInviteLink(invite.link)}
                  >
                    <Copy className="h-4 w-4" />
                    <span className="sr-only">Copy invite link</span>
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => handleRemoveInvite(invite.id)}
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Remove invite</span>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
