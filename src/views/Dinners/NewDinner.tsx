import { type dinnerFormSchema } from "../../utils/types";
import { DinnerForm } from "./DinnerForm";
import { type z } from "zod";
import { api } from "../../utils/api";
import { toast } from "../../components/ui/use-toast";
import { usePostHog } from "posthog-js/react";
import { ChefHat } from "lucide-react";
import { useRouter } from "next/router";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalTrigger,
} from "../../components/ResponsiveModal";
import { Card, CardContent } from "../../components/ui/card";

export const NewDinner = () => {
  const utils = api.useUtils();
  const posthog = usePostHog();
  const router = useRouter();
  const dialogOpen = router.pathname === "/dinners/new";
  const setDialogOpen = (open: boolean) => {
    void router.push(open ? "/dinners/new" : "/dinners");
  };

  const createDinnerMutation = api.dinner.create.useMutation({
    onSuccess: (result) => {
      toast({
        title: `${result.dinner.name} created`,
      });
      setDialogOpen(false);
    },
    onSettled: () => {
      void utils.dinner.dinners.invalidate();
    },
  });

  function createDinner(values: z.infer<typeof dinnerFormSchema>) {
    posthog.capture("create new dinner", { dinnerName: values.name });

    createDinnerMutation.mutate({
      dinnerName: values.name,
      tagList: values.tags,
      link: values.link,
      notes: values.notes,
    });
  }

  return (
    <ResponsiveModal open={dialogOpen} onOpenChange={setDialogOpen}>
      <ResponsiveModalTrigger asChild>
        <Card className="flex min-h-[100px] cursor-pointer flex-col items-center justify-center border-dashed bg-transparent transition-colors hover:border-primary/50 hover:bg-accent/50">
          <CardContent className="flex h-full flex-col items-center justify-center gap-2 p-4 text-muted-foreground hover:text-primary">
            <ChefHat className="h-6 w-6 sm:h-8 sm:w-8" />
            <span className="text-sm font-medium sm:text-base">
              Add new dinner
            </span>
          </CardContent>
        </Card>
      </ResponsiveModalTrigger>
      <ResponsiveModalContent>
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>New dinner</ResponsiveModalTitle>
        </ResponsiveModalHeader>
        <DinnerForm
          closeDialog={() => setDialogOpen(false)}
          onSubmit={createDinner}
          isLoading={createDinnerMutation.isLoading}
        />
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
};
