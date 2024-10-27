import { usePostHog } from "posthog-js/react";
import { Button } from "../../components/ui/button";
import { api } from "../../utils/api";
import { type DinnerWithTags } from "../../utils/types";
import { format, isSameDay, startOfWeek } from "date-fns";
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogContent,
} from "../../components/ui/dialog";
import { ClearDay } from "./ClearDay";

type Props = {
  dinner: DinnerWithTags;
  date: Date;
  closeDialog: () => void;
};

export const PlannedDinner = ({ dinner, date, closeDialog }: Props) => {
  return (
    <DialogContent className="flex max-h-[90vh] flex-col">
      <DialogHeader>
        <DialogDescription>
          {format(date, "EEEE, LLLL  do, y")}
        </DialogDescription>
        <DialogTitle>{dinner.name}</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-2">
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
    </DialogContent>
  );
};
