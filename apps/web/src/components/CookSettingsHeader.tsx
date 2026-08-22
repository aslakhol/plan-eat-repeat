import Link from "next/link";
import { ChevronRight, MoreHorizontal, Users } from "lucide-react";

import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalTitle,
  ResponsiveModalTrigger,
} from "~/components/ResponsiveModal";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { useKeepScreenAwakePreference } from "~/hooks/use-keep-screen-awake";
import { useState } from "react";

export const CookSettingsHeader = ({
  title,
  showSharedDinnersShortcut = false,
}: {
  title: string;
  showSharedDinnersShortcut?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const { enabled, isReady, setEnabled } = useKeepScreenAwakePreference();

  return (
    <div className="flex items-center justify-between gap-4">
      <h1 className="text-foreground font-serif text-3xl font-normal">
        {title}
      </h1>
      <div className="flex shrink-0 items-center gap-2">
        {showSharedDinnersShortcut && (
          <Button
            asChild
            variant="outline"
            size="icon"
            className="size-9 rounded-full bg-white"
          >
            <Link href="/dinners/shared" aria-label="Open shared dinners">
              <Users className="size-4" />
            </Link>
          </Button>
        )}
        <ResponsiveModal open={open} onOpenChange={setOpen}>
          <ResponsiveModalTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-9 shrink-0 rounded-full bg-white"
              aria-label="Open cook settings"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </ResponsiveModalTrigger>
          <ResponsiveModalContent
            scrollViewport
            scrollViewportClassName="grid gap-5"
            className="h-auto max-h-[70dvh] gap-5 bg-white md:max-w-sm"
          >
            <div>
              <ResponsiveModalTitle className="pb-1 text-left font-serif text-xl font-normal">
                Cook settings
              </ResponsiveModalTitle>
              <ResponsiveModalDescription className="text-left text-xs leading-relaxed">
                Preferences apply only in this browser.
              </ResponsiveModalDescription>
            </div>

            <div className="border-border flex items-center justify-between gap-4 rounded-xl border px-4 py-3">
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

            <nav className="border-border overflow-hidden rounded-xl border">
              <Link
                href="/dinners/shared"
                className="hover:bg-muted flex min-h-11 items-center justify-between gap-3 px-4 py-3 text-sm font-bold"
                onClick={() => setOpen(false)}
              >
                Shared dinners
                <ChevronRight className="text-muted-foreground size-4" />
              </Link>
              <Link
                href="/settings"
                className="hover:bg-muted flex min-h-11 items-center justify-between gap-3 border-t px-4 py-3 text-sm font-bold"
                onClick={() => setOpen(false)}
              >
                Settings
                <ChevronRight className="text-muted-foreground size-4" />
              </Link>
            </nav>
          </ResponsiveModalContent>
        </ResponsiveModal>
      </div>
    </div>
  );
};
