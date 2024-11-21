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
    <div className="min-h-screen max-w-xl border-r">
      {!household ? (
        <div className="p-4">
          <NewHousehold />
        </div>
      ) : (
        <div className="space-y-4 p-4">
          <EditHousehold household={household} />
          <Memberships household={household} />
          {userIsAdmin && <Invites household={household} />}
          <Button asChild variant="outline">
            <Link href="/settings">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Link>
          </Button>
        </div>
      )}
      <BottomNav />
    </div>
  );
};
