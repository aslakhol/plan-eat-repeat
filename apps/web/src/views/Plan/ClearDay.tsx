import { format } from "date-fns";
import { usePostHog } from "posthog-js/react";
import { Button, type ButtonProps } from "../../components/ui/button";
import { api } from "../../utils/api";
import { UtensilsCrossed } from "lucide-react";
import { type ReactNode } from "react";
import { cn } from "~/lib/utils";

type ClearDayProps = {
  date: Date;
  closeDialog: () => void;
  children?: ReactNode;
  className?: string;
  variant?: ButtonProps["variant"];
  onBeforeClear?: () => void;
};

export const ClearDay = ({
  date,
  closeDialog,
  children = "Clear day",
  className,
  variant = "outline",
  onBeforeClear,
}: ClearDayProps) => {
  const posthog = usePostHog();
  const utils = api.useUtils();
  const unplanDayMutation = api.plan.unplanDay.useMutation({
    onSuccess: () => {
      void utils.plan.plannedDinners.invalidate();
      void utils.dinner.summaries.invalidate();
      posthog.capture("clear day", {
        day: format(date, "EEE do"),
      });
      closeDialog();
    },
  });
  return (
    <Button
      variant={variant}
      className={cn(!className && "w-24", className)}
      onClick={() => {
        onBeforeClear?.();
        unplanDayMutation.mutate({
          date,
        });
      }}
      disabled={unplanDayMutation.isPending}
    >
      {!unplanDayMutation.isPending ? (
        children
      ) : (
        <UtensilsCrossed className="animate-spin" size={14} />
      )}
    </Button>
  );
};
