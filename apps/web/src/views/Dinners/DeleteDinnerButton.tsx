import { useState } from "react";
import { format } from "date-fns";
import { Trash2 } from "lucide-react";
import { api } from "../../utils/api";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";

type Props = {
  dinnerId: number;
  isPending: boolean;
  onDelete: () => void;
};

export const DeleteDinnerButton = ({
  dinnerId,
  isPending,
  onDelete,
}: Props) => {
  const [open, setOpen] = useState(false);
  const plansQuery = api.plan.plansForDinner.useQuery(
    { dinnerId },
    { enabled: open },
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="hover:bg-destructive/5 w-full border-[hsl(0_50%_85%)] text-[hsl(0_60%_48%)] hover:text-[hsl(0_60%_42%)]"
        >
          <Trash2 />
          Delete dinner
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete dinner</DialogTitle>
          <DialogDescription>
            Are you sure? This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {plansQuery.isSuccess && plansQuery.data.plans.length > 0 && (
          <div className="space-y-2 text-sm">
            <p>The plans on these dates will also be deleted:</p>
            <ul className="max-h-[200px] space-y-1 overflow-y-auto rounded-md border p-3">
              {plansQuery.data.plans.map((plan) => (
                <li key={plan.id}>{format(plan.date, "LLLL do, y")}</li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isPending || plansQuery.isPending}
            onClick={onDelete}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
