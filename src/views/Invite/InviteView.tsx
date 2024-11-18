import { UtensilsCrossed } from "lucide-react";

import { api } from "../../utils/api";
import { NoInvite } from "./NoInvite";
import { Invitation } from "./Invitation";
import { AlreadyInHousehold } from "./AlreadyInHousehold";

type Props = { inviteId: string };

export const InviteView = ({ inviteId }: Props) => {
  const inviteQuery = api.household.getInvite.useQuery({ inviteId });
  const householdsForUserQuery = api.household.householdsForUser.useQuery();

  if (inviteQuery.isLoading || householdsForUserQuery.isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <UtensilsCrossed className="animate-spin" />
      </div>
    );
  }

  if (!inviteQuery.data?.invite) {
    return <NoInvite />;
  }

  const alreadyInHousehold = !!householdsForUserQuery.data?.households.find(
    (household) => household.id === inviteQuery.data?.invite?.householdId,
  );

  if (alreadyInHousehold) {
    return <AlreadyInHousehold household={inviteQuery.data.invite.household} />;
  }

  return <Invitation invite={inviteQuery.data.invite} />;
};
