import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";
import { cn } from "../../lib/utils";
import { type dinnerFormSchema, type DinnerWithTags } from "../../utils/types";
import { DinnerForm } from "./DinnerForm";
import { type z } from "zod";
import { api } from "../../utils/api";
import { toast } from "../../components/ui/use-toast";
import { usePostHog } from "posthog-js/react";
import { NewDinner } from "./NewDinner";

type Props = {
  dinners: DinnerWithTags[];
};
export const DinnerList = ({ dinners }: Props) => {
  return (
    <div className="flex flex-col gap-4">
      <NewDinner />
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

  const updateDinnerMutation = api.dinner.edit.useMutation({
    onSuccess: (result) => {
      toast({
        title: `${result.dinner.name} updated`,
      });
      setDialogOpen(false);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Something went wrong",
        description: error.message,
      });
    },
  });

  const deleteDinnerMutation = api.dinner.delete.useMutation({
    onSuccess: (result) => {
      toast({
        title: `${result.dinner.name} deleted`,
      });
      setDialogOpen(false);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Something went wrong",
        description: error.message,
      });
    },
  });

  const utils = api.useUtils();
  const posthog = usePostHog();

  function updateDinner(values: z.infer<typeof dinnerFormSchema>) {
    posthog.capture("update dinner", { dinnerName: values.name });

    updateDinnerMutation.mutate(
      {
        dinnerName: values.name,
        dinnerId: dinner.id,
        secret: localStorage.getItem("sulten-secret"),
        tagList: values.tags,
        link: values.link,
        notes: values.notes,
      },
      {
        onSettled: () => {
          void utils.dinner.dinners.invalidate();
        },
      },
    );
  }

  function deleteDinner(values: z.infer<typeof dinnerFormSchema>) {
    posthog.capture("delete dinner", { dinnerName: values.name });

    deleteDinnerMutation.mutate(
      {
        dinnerId: dinner.id,
        secret: localStorage.getItem("sulten-secret"),
      },
      {
        onSettled: () => {
          void utils.dinner.dinners.invalidate();
        },
      },
    );
  }

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
          onSubmit={updateDinner}
          onDelete={deleteDinner}
        />
      </DialogContent>
    </Dialog>
  );
};
