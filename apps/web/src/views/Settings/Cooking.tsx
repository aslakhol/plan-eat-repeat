import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { useKeepScreenAwakePreference } from "~/hooks/use-keep-screen-awake";
import { cn } from "~/lib/utils";

export const Cooking = () => {
  const { enabled, isReady, setEnabled } = useKeepScreenAwakePreference();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cooking</CardTitle>
        <CardDescription>
          Preferences apply only in this browser.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-bold">Keep screen awake</p>
            <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
              While a Dinner is open for cooking.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-label="Keep screen awake"
            aria-checked={enabled}
            disabled={!isReady}
            className={cn(
              "focus-visible:ring-ring relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50",
              enabled ? "bg-primary" : "bg-muted-foreground/30",
            )}
            onClick={() => setEnabled(!enabled)}
          >
            <span
              aria-hidden="true"
              className={cn(
                "absolute left-1 top-1 size-5 rounded-full bg-white shadow-sm transition-transform",
                enabled && "translate-x-5",
              )}
            />
          </button>
        </div>
      </CardContent>
    </Card>
  );
};
