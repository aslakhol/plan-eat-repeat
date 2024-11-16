import { type Household } from "@prisma/client";
import { BottomNav } from "../BottomNav";
import { NewHousehold } from "./HouseholdForm";
import { EditHousehold } from "./HouseholdForm";
import { Memberships } from "./Memberships";

type Props = { currentHousehold?: Household };

export const HouseholdView = ({ currentHousehold }: Props) => {
  return (
    <div>
      {!currentHousehold ? (
        <NewHousehold />
      ) : (
        <div className=" space-y-8 p-4">
          <EditHousehold household={currentHousehold} />
          <Memberships household={currentHousehold} />
        </div>
      )}
      <BottomNav />
    </div>
  );
};
