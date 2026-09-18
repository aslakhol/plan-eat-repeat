import { LoadingIndicator } from "~/components/LoadingIndicator";

import { api } from "../../utils/api";
import { NoInvite } from "./NoInvite";
import { Invitation } from "./Invitation";
import { AlreadyInHousehold } from "./AlreadyInHousehold";
import { SignedIn, SignedOut } from "@clerk/nextjs";

type Props = { inviteId: string };

export const InviteView = ({ inviteId }: Props) => {
  const inviteQuery = api.household.getInvite.useQuery({ inviteId });

  if (inviteQuery.isPending) {
    return (
      <LoadingIndicator
        label="Loading invitation…"
        className="h-[50vh] w-full"
      />
    );
  }

  return (
    <>
      <SignedIn>
        <LoggedInInvite inviteId={inviteId} />
      </SignedIn>
      <SignedOut>
        {!inviteQuery.data?.invite ? (
          <NoInvite />
        ) : (
          <Invitation invite={inviteQuery.data.invite} />
        )}
      </SignedOut>
    </>
  );
};

type LoggedInInviteProps = { inviteId: string };

export const LoggedInInvite = ({ inviteId }: LoggedInInviteProps) => {
  const inviteQuery = api.household.getInvite.useQuery({ inviteId });
  const householdQuery = api.household.household.useQuery();

  if (inviteQuery.isPending || householdQuery.isPending) {
    return (
      <LoadingIndicator
        label="Loading invitation…"
        className="h-[50vh] w-full"
      />
    );
  }

  if (!inviteQuery.data?.invite) {
    return <NoInvite />;
  }

  const alreadyInHousehold =
    !!householdQuery.data?.household &&
    householdQuery.data.household.id === inviteQuery.data?.invite?.householdId;

  if (alreadyInHousehold) {
    return <AlreadyInHousehold household={inviteQuery.data.invite.household} />;
  }

  return <Invitation invite={inviteQuery.data.invite} />;
};
