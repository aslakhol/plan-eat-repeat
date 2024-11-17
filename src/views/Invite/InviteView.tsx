import { UtensilsCrossed } from "lucide-react";

import { api } from "../../utils/api";
import { NoInvite } from "./NoInvite";
import { Invitation } from "./Invitation";

type Props = { inviteId: string };

export const InviteView = ({ inviteId }: Props) => {
  const inviteQuery = api.household.getInvite.useQuery({ inviteId });

  if (inviteQuery.isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <UtensilsCrossed className="animate-spin" />
      </div>
    );
  }

  if (!inviteQuery.data?.invite) {
    return <NoInvite />;
  }

  return <Invitation invite={inviteQuery.data.invite} />;
};
