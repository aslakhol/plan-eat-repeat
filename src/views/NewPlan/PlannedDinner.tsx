import { usePostHog } from "posthog-js/react";
import { Button } from "../../components/ui/button";
import { api } from "../../utils/api";
import { type DinnerWithTags } from "../../utils/types";
import { format, isSameDay, startOfWeek } from "date-fns";

type Props = {
  dinner: DinnerWithTags;
  date: Date;
  closeDialog: () => void;
};

export const PlannedDinner = ({ dinner, date, closeDialog }: Props) => {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-lg font-semibold">{dinner.name}</h1>
      {dinner.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {dinner.tags.map((tag) => (
            <div
              className="rounded border border-green-100 bg-green-100 px-2 py-1 text-green-800"
              key={tag.value}
            >
              {tag.value}
            </div>
          ))}
        </div>
      )}
      {dinner.link && (
        <a
          className="line-clamp-1 max-w-md text-sm text-blue-500 underline"
          href={dinner.link}
          target="_blank"
        >
          {dinner.link}
        </a>
      )}
      {dinner.notes && (
        <div className="min-h-[100px]">
          {dinner.notes.split("\n").map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}

      <div className="flex w-full gap-2">
        <Button variant={"outline"}>Change plan</Button>
        <ClearDay date={date} closeDialog={closeDialog} />
        <Button variant={"outline"}>Edit dinner</Button>
      </div>
    </div>
  );
};

type ClearDayProps = { date: Date; closeDialog: () => void };

const ClearDay = ({ date, closeDialog }: ClearDayProps) => {
  const posthog = usePostHog();
  const utils = api.useUtils();
  const unplanDayMutation = api.plan.unplanDay.useMutation({
    onMutate: (input) => {
      void utils.plan.plannedDinners.cancel();
      const prevPlannedDinners = utils.plan.plannedDinners.getData();
      utils.plan.plannedDinners.setData(
        { startOfWeek: startOfWeek(date ?? new Date(), { weekStartsOn: 1 }) },
        (old) => {
          return {
            plans:
              old?.plans.filter((plan) => !isSameDay(plan.date, input.date)) ??
              [],
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
    onSettled: async () => {
      await utils.plan.plannedDinners.invalidate();
    },
    onSuccess: (res) => {
      posthog.capture("clear day", { day: format(res.deleted.date, "EEE do") });
      closeDialog();
    },
  });
  return (
    <Button
      variant={"outline"}
      onClick={() =>
        unplanDayMutation.mutate({
          date,
          secret: localStorage.getItem("sulten-secret"),
        })
      }
    >
      Clear day
    </Button>
  );
};
