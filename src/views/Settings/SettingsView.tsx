import { type Household } from "@prisma/client";
import { BottomNav } from "../BottomNav";
import { NewHousehold } from "./HouseholdForm";
import { EditHousehold } from "./HouseholdForm";
import { Memberships } from "./Memberships";
import { Invites } from "./Invites";
import { api } from "../../utils/api";
import { useClerk } from "@clerk/nextjs";
import { ArrowLeft } from "lucide-react";
import { Button } from "../../components/ui/button";
import Link from "next/link";
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
    <div className="min-h-screen max-w-xl border-r">
      {!household ? (
        <div className="space-y-4 p-4">
          <NewHousehold />
          <Account />
        </div>
      ) : (
        <div className="space-y-4 p-4">
          <Account />
          <EditHousehold household={household} />
          <Memberships household={household} />
          {userIsAdmin && <Invites household={household} />}
        </div>
      )}
      <BottomNav />
    </div>
  );
};
