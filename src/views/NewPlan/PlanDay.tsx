import { format } from "date-fns";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogContent,
} from "../../components/ui/dialog";
import { type DinnerWithTags } from "../../utils/types";
import { api } from "../../utils/api";
import { cn } from "../../lib/utils";
import { ClearDay } from "./ClearDay";
import { Button } from "../../components/ui/button";
import { Filter } from "./Filter";
import { useState } from "react";

type Props = {
  date: Date;
  closeDialog: () => void;
  plannedDinner?: DinnerWithTags;
};

export const PlanDay = ({ date, closeDialog, plannedDinner }: Props) => {
  const dinnersQuery = api.dinner.dinners.useQuery();
  const [search, setSearch] = useState("");
  const [showTags, setShowTags] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const dinners = dinnersQuery.data?.dinners
    .filter(
      (dinner) =>
        !search || dinner.name.toLowerCase().includes(search.toLowerCase()),
    )
    .filter(
      (dinner) =>
        selectedTags.length === 0 ||
        !showTags ||
        selectedTags.every((tag) =>
          dinner.tags.map((t) => t.value).includes(tag),
        ),
    );

  return (
    <DialogContent className="flex flex-col">
      <DialogHeader>
        <DialogDescription>
          {format(date, "EEEE, LLLL  do, y")}
        </DialogDescription>
        <DialogTitle>
          {plannedDinner ? plannedDinner.name : "Nothing planned yet"}
        </DialogTitle>
      </DialogHeader>

      <Filter
        search={search}
        setSearch={setSearch}
        showTags={showTags}
        setShowTags={setShowTags}
        selectedTags={selectedTags}
        setSelectedTags={setSelectedTags}
      />

      <div className="flex flex-col overflow-hidden">
        {/* Filters and search */}
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
          {dinners?.map((dinner) => <Dinner key={dinner.id} dinner={dinner} />)}
        </div>
      </div>
      <div className="flex w-full justify-between gap-2">
        <Button variant={"outline"}>New dinner</Button>
        {plannedDinner && <ClearDay date={date} closeDialog={closeDialog} />}
      </div>
    </DialogContent>
  );
};

type DinnerProps = { dinner: DinnerWithTags; plannedDinner?: DinnerWithTags };

const Dinner = ({ dinner, plannedDinner }: DinnerProps) => {
  const isPlanned = plannedDinner?.id === dinner.id;

  const handleClick = () => {
    console.log("clicked");
  };

  return (
    <div
      className={cn(
        "flex cursor-pointer flex-col rounded border px-4 py-2 hover:bg-accent/50 hover:text-accent-foreground",
        isPlanned && "bg-accent/50 text-accent-foreground hover:bg-accent",
      )}
      onClick={handleClick}
    >
      <h3 className="font-semibold">{dinner.name}</h3>
    </div>
  );
};
