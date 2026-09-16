import { UtensilsCrossed } from "lucide-react";
import { cn } from "~/lib/utils";

export function LoadingIndicator({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn("flex items-center justify-center py-8", className)}
    >
      <UtensilsCrossed
        aria-hidden="true"
        className="text-primary animate-spin"
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}
