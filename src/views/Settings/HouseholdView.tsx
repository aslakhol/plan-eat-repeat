import { type Household } from "@prisma/client";
import { BottomNav } from "../BottomNav";
import { NewHousehold } from "./HouseholdForm";
import { EditHousehold } from "./HouseholdForm";

type Props = { currentHousehold?: Household };

export const HouseholdView = ({ currentHousehold }: Props) => {
  return (
    <div>
      <div className="flex flex-col p-4">
        {currentHousehold ? (
          <EditHousehold household={currentHousehold} />
        ) : (
          <NewHousehold />
        )}
      </div>
      <BottomNav />
    </div>
  );
};
