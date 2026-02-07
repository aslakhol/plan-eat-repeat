import { cn } from "../../lib/utils";
import { type dinnerFormSchema, type DinnerWithTags } from "../../utils/types";
import { DinnerForm } from "./DinnerForm";
import { z } from "zod";
import { api } from "../../utils/api";
import { toast } from "../../components/ui/use-toast";
import { usePostHog } from "posthog-js/react";
import { NewDinner } from "./NewDinner";
import { useRouter } from "next/router";
import { Badge } from "../../components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalTrigger,
} from "../../components/ResponsiveModal";

type Props = {
  dinners: DinnerWithTags[];
  selectedTags: string[];
};

export const DinnerList = ({ dinners, selectedTags }: Props) => {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <NewDinner />
      {dinners.map((d) => (
        <DinnerListItem key={d.id} dinner={d} selectedTags={selectedTags} />
      ))}
    </div>
  );
};

type DinnerListItemProps = {
  dinner: DinnerWithTags;
  selectedTags: string[];
};

const DinnerListItem = ({ dinner, selectedTags }: DinnerListItemProps) => {
  const router = useRouter();
  const dialogOpen = Number(router.query.dinnerId) === dinner.id;
  const setDialogOpen = (open: boolean) => {
    void router.push(open ? `/dinners/${dinner.id}` : "/dinners");
  };

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
      },
      {
        onSettled: () => {
          void utils.dinner.dinners.invalidate();
        },
      },
    );
  }

  return (
    <ResponsiveModal open={dialogOpen} onOpenChange={setDialogOpen}>
      <ResponsiveModalTrigger asChild>
        <Card className="flex h-full min-h-[100px] cursor-pointer flex-col justify-between transition-colors hover:bg-accent/50">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="line-clamp-2 font-serif text-base font-medium leading-tight sm:text-lg">
              {dinner.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="flex flex-wrap gap-2">
              {dinner.tags.map((tag) => {
                return (
                  <Badge
                    key={tag.value}
                    variant="secondary"
                    className={cn(
                      selectedTags.includes(tag.value) &&
                        "border border-primary bg-primary/10",
                    )}
                  >
                    {tag.value}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </ResponsiveModalTrigger>
      <ResponsiveModalContent>
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>{dinner.name}</ResponsiveModalTitle>
        </ResponsiveModalHeader>
        <DinnerForm
          existingDinner={dinner}
          closeDialog={() => setDialogOpen(false)}
          onSubmit={updateDinner}
          onDelete={deleteDinner}
          isPending={
            updateDinnerMutation.isPending || deleteDinnerMutation.isPending
          }
        />
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
};
