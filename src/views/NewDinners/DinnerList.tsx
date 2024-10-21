import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";
import { cn } from "../../lib/utils";
import { type DinnerWithTags } from "../../utils/types";
import { DinnerForm } from "./DinnerForm";
type Props = {
  dinners: DinnerWithTags[];
};
export const DinnerList = ({ dinners }: Props) => {
  return (
    <div className="flex flex-col gap-4">
      {dinners.map((d) => (
        <DinnerListItem key={d.id} dinner={d} />
      ))}
    </div>
  );
};

type DinnerListItemProps = {
  dinner: DinnerWithTags;
};

const DinnerListItem = ({ dinner }: DinnerListItemProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger>
        <div
          className={cn(
            "flex cursor-pointer flex-col rounded-md border px-4 py-2 text-left hover:bg-accent/50 hover:text-accent-foreground",
          )}
        >
          <h3 className="font-semibold">{dinner.name}</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {dinner.tags.map((tag) => {
              return (
                <div
                  key={tag.value}
                  className="rounded bg-green-100 px-2 py-1 text-green-800 active:bg-green-200"
                >
                  {tag.value}
                </div>
              );
            })}
          </div>
        </div>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dinner.name}</DialogTitle>
        </DialogHeader>
        <DinnerForm
          existingDinner={dinner}
          closeDialog={() => setDialogOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
};
