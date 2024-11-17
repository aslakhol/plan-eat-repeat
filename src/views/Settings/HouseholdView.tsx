import { type Household } from "@prisma/client";
import { BottomNav } from "../BottomNav";
import { NewHousehold } from "./HouseholdForm";
import { EditHousehold } from "./HouseholdForm";
import { Memberships } from "./Memberships";
import { Invites } from "./Invites";
import { api } from "../../utils/api";
import { useClerk } from "@clerk/nextjs";

type Props = { currentHousehold?: Household };

export const HouseholdView = ({ currentHousehold }: Props) => {
  const { user } = useClerk();
  const membersQuery = api.household.members.useQuery(
    { householdId: currentHousehold?.id ?? "" },
    { enabled: !!currentHousehold },
  );
  const userIsAdmin = !!membersQuery.data?.members.some(
    (member) => member.userId === user?.id && member.role === "ADMIN",
  );
  return (
    <div>
      {!currentHousehold ? (
        <NewHousehold />
      ) : (
        <div className=" space-y-8 p-4">
          <EditHousehold household={currentHousehold} />
          <Memberships household={currentHousehold} />
          {userIsAdmin && <Invites household={currentHousehold} />}
        </div>
      )}
      <BottomNav />
    </div>
  );
};
