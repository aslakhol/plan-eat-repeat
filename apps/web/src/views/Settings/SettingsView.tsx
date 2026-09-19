import type { Household } from "@planeatrepeat/db";
import { EditHousehold } from "./HouseholdForm";
import { Memberships } from "./Memberships";
import { Invites } from "./Invites";
import { api } from "../../utils/api";
import { useClerk } from "@clerk/nextjs";
import { Account } from "./Account";
import { Cooking } from "./Cooking";
import { ShoppingList } from "./ShoppingList";

type Props = { household: Household; systemDefaultPrompt: string };

export const SettingsView = ({ household, systemDefaultPrompt }: Props) => {
  const { user } = useClerk();
  const membersQuery = api.household.members.useQuery({
    householdId: household.id,
  });
  const userIsAdmin = !!membersQuery.data?.members.some(
    (member) => member.userId === user?.id && member.role === "ADMIN",
  );

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="text-foreground font-serif text-3xl font-bold">
        Settings
      </h1>
      <div className="flex flex-col gap-6">
        <Account />
        <Cooking />
        <ShoppingList language={household.shoppingLanguage} />
        <EditHousehold
          key={household.id}
          household={household}
          systemDefaultPrompt={systemDefaultPrompt}
        />
        <Memberships household={household} />
        {userIsAdmin && <Invites household={household} />}
      </div>
    </div>
  );
};
