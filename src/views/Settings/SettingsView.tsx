import { type Household } from "@prisma/client";
import { NewHousehold } from "./HouseholdForm";
import { EditHousehold } from "./HouseholdForm";
import { Memberships } from "./Memberships";
import { Invites } from "./Invites";
import { api } from "../../utils/api";
import { useClerk } from "@clerk/nextjs";
import { Account } from "./Account";

type Props = { household: Household | null };

export const SettingsView = ({ household }: Props) => {
  const { user } = useClerk();
  const membersQuery = api.household.members.useQuery(
    { householdId: household?.id ?? "" },
    { enabled: !!household },
  );
  const userIsAdmin = !!membersQuery.data?.members.some(
    (member) => member.userId === user?.id && member.role === "ADMIN",
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-serif text-3xl font-bold text-foreground">
        Settings
      </h1>
      <div className="flex max-w-3xl flex-col gap-6">
        {!household ? (
          <>
            <NewHousehold />
            <Account />
          </>
        ) : (
          <>
            <Account />
            <EditHousehold household={household} />
            <Memberships household={household} />
            {userIsAdmin && <Invites household={household} />}
          </>
        )}
      </div>
    </div>
  );
};
