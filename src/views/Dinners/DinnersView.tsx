import { api } from "~/utils/api";
import { Dinners } from "./Dinners";
import { BottomNav } from "../BottomNav";
import { Dialog } from "../../components/ui/dialog";
import { SelectDinnerDialogContent } from "./SelectDinnerDialogContent";
import { useState } from "react";

export const DinnersView = () => {
  const dinnersQuery = api.dinner.dinners.useQuery();
  const [selectedDinnerId, setSelectedDinnerId] = useState<number>();

  return (
    <div className="grid h-screen">
      <Dialog>
        <div>
          {dinnersQuery.data?.dinners && (
            <Dinners
              dinners={dinnersQuery.data.dinners}
              setSelectedDinnerId={setSelectedDinnerId}
            />
          )}
        </div>
        <SelectDinnerDialogContent
          dinner={dinnersQuery.data?.dinners.find(
            (dinner) => dinner.id === selectedDinnerId,
          )}
        />
      </Dialog>

      <BottomNav />
    </div>
  );
};