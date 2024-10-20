import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";
import { cn } from "../../lib/utils";
import { type DinnerWithTags } from "../../utils/types";
type Props = {
  dinners: DinnerWithTags[];
};
export const DinnerList = ({ dinners }: Props) => {
  return (
    <div className="flex flex-col gap-4">
      {dinners.map((d) => (
        <Dialog key={d.id}>
          <DialogTrigger>
            <div
              className={cn(
                "flex cursor-pointer flex-col rounded-md border px-4 py-2 text-left hover:bg-accent/50 hover:text-accent-foreground",
              )}
            >
              <h3 className="font-semibold">{d.name}</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {d.tags.map((tag) => {
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
            <DialogTitle>{d.name}</DialogTitle>
          </DialogContent>
        </Dialog>
      ))}
    </div>
  );
};
