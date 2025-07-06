import { Button } from "../../components/ui/button";
import { type DinnerWithTags } from "../../utils/types";
import { format } from "date-fns";
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogContent,
} from "../../components/ui/dialog";
import { ClearDay } from "./ClearDay";
import Link from "next/link";
import { Badge } from "../../components/ui/badge";
import useWakeLock from "react-use-wake-lock";
import { useEffect } from "react";

type Props = {
  dinner: DinnerWithTags;
  date: Date;
  closeDialog: () => void;
  setChangePlan: (change: boolean) => void;
  isOpen: boolean;
};

export const PlannedDinner = ({
  dinner,
  date,
  closeDialog,
  setChangePlan,
  isOpen,
}: Props) => {
  const { isSupported, isLocked, request, release } = useWakeLock();

  useEffect(() => {
    if (!isSupported) {
      return;
    }
    if (!isOpen) {
      release();
      return;
    }

    request();

    return () => {
      release();
    };
  }, [isSupported, isOpen, request, release]);

  return (
    <DialogContent className="flex flex-col">
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
              <Badge key={tag.value} variant="secondary">
                {tag.value}
              </Badge>
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
          <Button variant={"outline"} onClick={() => setChangePlan(true)}>
            Change plan
          </Button>
          <ClearDay date={date} closeDialog={closeDialog} />
          <Button variant={"outline"} asChild>
            <Link href={`/dinners/${dinner.id}`}>Edit dinner</Link>
          </Button>
        </div>
      </div>
    </DialogContent>
  );
};
