import { type Household } from "@prisma/client";
import { BottomNav } from "../BottomNav";
import { NewHousehold } from "./HouseholdForm";
import { EditHousehold } from "./HouseholdForm";
import { Memberships } from "./Memberships";
import { Invites } from "./Invites";
import { api } from "../../utils/api";
import { useClerk } from "@clerk/nextjs";

type Props = { household: Household | null };

export const HouseholdView = ({ household }: Props) => {
  const { user } = useClerk();
  const membersQuery = api.household.members.useQuery(
    { householdId: household?.id ?? "" },
    { enabled: !!household },
  );
  const userIsAdmin = !!membersQuery.data?.members.some(
    (member) => member.userId === user?.id && member.role === "ADMIN",
  );

  return (
    <div>
      {!household ? (
        <div className="p-4">
          <NewHousehold />
        </div>
      ) : (
        <div className="space-y-8 p-4">
          <EditHousehold household={household} />
          <Memberships household={household} />
          {userIsAdmin && <Invites household={household} />}
        </div>
      )}
      <BottomNav />
    </div>
  );
};
