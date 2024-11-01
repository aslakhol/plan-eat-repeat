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
import { Filter } from "../Filter";
import { useState } from "react";
import { usePostHog } from "posthog-js/react";
import { type Dinner } from "@prisma/client";
import Link from "next/link";

type Props = {
  date: Date;
  closeDialog: () => void;
  plannedDinner?: DinnerWithTags;
};

export const PlanDay = ({ date, closeDialog, plannedDinner }: Props) => {
  const posthog = usePostHog();
  const utils = api.useUtils();
  const [search, setSearch] = useState("");
  const [showTags, setShowTags] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const dinnersQuery = api.dinner.dinners.useQuery();
  const dinners = dinnersQuery.data?.dinners
    .filter(
      (dinner) =>
        !search || dinner.name.toLowerCase().includes(search.toLowerCase()),
    )
    .filter(
      (dinner) =>
        selectedTags.length === 0 ||
        selectedTags.every((tag) =>
          dinner.tags.map((t) => t.value).includes(tag),
        ),
    );

  const planDinnerForDateMutation = api.plan.planDinnerForDate.useMutation({
    onSuccess: (result) => {
      void utils.plan.plannedDinners.invalidate();
      posthog.capture("plan dinner from week page", {
        dinner:
          dinnersQuery.data?.dinners.find(
            (d) => d.id === result.newPlan.dinnerId,
          )?.name ?? "unknown",
        day: format(date, "EEE do"),
      });
      closeDialog();
    },
  });
  const planDinner = (dinnerId: number) => {
    planDinnerForDateMutation.mutate({
      date,
      dinnerId,
      secret: localStorage.getItem("sulten-secret"),
    });
  };

  return (
    <DialogContent className="flex h-[90vh] flex-col p-5">
      <DialogHeader>
        <DialogDescription>
          {format(date, "EEEE, LLLL do, y")}
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
        className="p-1"
      />

      <div className="flex flex-1 flex-col overflow-y-hidden">
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-1">
          {dinners?.map((dinner) => (
            <Dinner
              key={dinner.id}
              dinner={dinner}
              isPlanned={plannedDinner?.id === dinner.id}
              planDinner={planDinner}
              isLoading={planDinnerForDateMutation.isLoading}
            />
          ))}
        </div>
      </div>
      <div className="flex w-full justify-between gap-2 p-1">
        <Button asChild variant={"outline"}>
          <Link href="/dinners/new">New dinner</Link>
        </Button>
        {plannedDinner && <ClearDay date={date} closeDialog={closeDialog} />}
      </div>
    </DialogContent>
  );
};

type DinnerProps = {
  dinner: DinnerWithTags;
  isPlanned: boolean;
  planDinner: (dinnerId: number) => void;
  isLoading: boolean;
};

const Dinner = ({ dinner, isPlanned, planDinner, isLoading }: DinnerProps) => {
  return (
    <Button
      className={cn(
        "justify-start",
        isPlanned && "bg-accent/50 text-accent-foreground hover:bg-accent",
      )}
      variant={"outline"}
      disabled={isLoading}
      onClick={() => planDinner(dinner.id)}
    >
      {dinner.name}
    </Button>
  );
};
