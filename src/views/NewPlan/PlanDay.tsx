import { format, isSameDay, startOfWeek } from "date-fns";
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
import { type Dinner, type Plan } from "@prisma/client";

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
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
          {dinners?.map((dinner) => (
            <Dinner
              key={dinner.id}
              date={date}
              dinner={dinner}
              isPlanned={plannedDinner?.id === dinner.id}
              closeDialog={closeDialog}
            />
          ))}
        </div>
      </div>
      <div className="flex w-full justify-between gap-2">
        <Button variant={"outline"}>New dinner</Button>
        {plannedDinner && <ClearDay date={date} closeDialog={closeDialog} />}
      </div>
    </DialogContent>
  );
};

type DinnerProps = {
  date: Date;
  dinner: DinnerWithTags;
  isPlanned: boolean;
  closeDialog: () => void;
};

const Dinner = ({ date, dinner, isPlanned, closeDialog }: DinnerProps) => {
  const posthog = usePostHog();
  const utils = api.useUtils();

  const planDinnerForDateMutation = api.plan.planDinnerForDate.useMutation({
    onMutate: (input) => {
      void utils.plan.plannedDinners.cancel();

      const prevPlannedDinners = utils.plan.plannedDinners.getData();

      utils.plan.plannedDinners.setData(
        { startOfWeek: startOfWeek(date ?? new Date(), { weekStartsOn: 1 }) },
        (old) => {
          const oldPlans = old?.plans ?? [];
          const alreadyPlanned = oldPlans.find((plan) =>
            isSameDay(plan.date, input.date),
          );
          const newPlan: Plan & { dinner: DinnerWithTags } = {
            ...alreadyPlanned,
            dinnerId: input.dinnerId,
            dinner,
            id: alreadyPlanned?.id ?? Math.ceil(Math.random() * -10000),
            date: input.date,
          };

          return {
            plans: [
              ...oldPlans.filter((plan) => plan.id !== newPlan.id),
              newPlan,
            ],
          };
        },
      );

      return { prevPlannedDinners };
    },
    onError: (_, __, context) => {
      if (context?.prevPlannedDinners) {
        utils.plan.plannedDinners.setData(
          { startOfWeek: startOfWeek(date ?? new Date(), { weekStartsOn: 1 }) },
          context.prevPlannedDinners,
        );
      }
    },
    onSettled: () => {
      void utils.plan.plannedDinners.invalidate();
    },
    onSuccess: () => {
      posthog.capture("plan dinner from week page", {
        dinner: dinner.name,
        day: format(date, "EEE do"),
      });
      closeDialog();
    },
  });

  const handleClick = () => {
    return planDinnerForDateMutation.mutate({
      date,
      dinnerId: dinner.id,
      secret: localStorage.getItem("sulten-secret"),
    });
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
