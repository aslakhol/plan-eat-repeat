import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/router";
import { ChevronRight, Loader2, Plus } from "lucide-react";
import { dinnerNameSchema } from "@planeatrepeat/shared";
import { api } from "~/utils/api";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "~/components/ResponsiveModal";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const importSources = ["Link", "YouTube video", "Photos", "Text"] as const;

function RecipeActionRow({
  children,
  dashed = false,
  onClick,
}: {
  children: ReactNode;
  dashed?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className={cn(
        "h-12 w-full justify-between rounded-lg bg-white px-4 text-left text-sm font-semibold",
        dashed && "border-dashed",
      )}
      onClick={onClick}
    >
      {children}
      <ChevronRight className="text-muted-foreground size-4" />
    </Button>
  );
}

export function AddDinnerSheet({ open, onOpenChange }: Props) {
  const router = useRouter();
  const utils = api.useUtils();
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setName("");
      setValidationError(null);
      return;
    }

    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 100);
    return () => window.clearTimeout(focusTimer);
  }, [open]);

  const createMutation = api.dinner.create.useMutation({
    onSuccess: async ({ dinner }) => {
      await Promise.all([
        utils.dinner.dinners.invalidate(),
        utils.dinner.tags.invalidate(),
      ]);

      onOpenChange(false);

      // Put bare Cookbook directly beneath the URL-addressed sheet even when
      // creation began from Week, so browser Back follows the sheet contract.
      if (router.asPath !== "/dinners") {
        await router.push("/dinners");
      }
      await router.push(`/dinners/${dinner.id}`);
    },
    onError: (error) => {
      setValidationError(error.message);
    },
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = dinnerNameSchema.safeParse(name);
    if (!result.success) {
      setValidationError(
        result.error.issues[0]?.message ?? "Add a dinner name",
      );
      return;
    }

    setValidationError(null);
    createMutation.mutate({ dinnerName: result.data, tagList: [] });
  };

  const continueInExistingCreateFlow = () => {
    onOpenChange(false);
    void router.push("/dinners/new");
  };

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent className="h-auto max-h-[calc(100dvh-1rem)] gap-0 overflow-y-auto bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 md:max-w-lg md:p-6">
        <ResponsiveModalHeader className="mb-5 text-center">
          <ResponsiveModalTitle className="font-serif text-xl font-normal">
            Add a dinner
          </ResponsiveModalTitle>
          <ResponsiveModalDescription className="sr-only">
            Quick-add a Name-only Dinner or continue to Recipe creation.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <form onSubmit={submit} className="space-y-2">
          <div className="grid grid-cols-[minmax(0,1fr)_3.25rem] gap-2">
            <Input
              ref={inputRef}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setValidationError(null);
              }}
              autoFocus
              disabled={createMutation.isPending}
              placeholder="What's for dinner?"
              aria-label="Dinner name"
              aria-invalid={validationError !== null}
              className="h-[52px] min-w-0 rounded-lg bg-white px-4 text-base font-semibold"
            />
            <Button
              type="submit"
              size="icon"
              aria-label="Add Name-only Dinner"
              disabled={name.trim().length === 0 || createMutation.isPending}
              className="h-[52px] w-[52px] rounded-lg"
            >
              {createMutation.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Plus className="size-6" />
              )}
            </Button>
          </div>
          {validationError && (
            <p role="alert" className="text-destructive text-sm">
              {validationError}
            </p>
          )}
        </form>

        <div className="mt-6">
          <p className="text-muted-foreground mb-2 text-xs font-bold uppercase tracking-[0.12em]">
            Import a recipe
          </p>
          <div className="space-y-2">
            {importSources.map((source) => (
              <RecipeActionRow
                key={source}
                onClick={continueInExistingCreateFlow}
              >
                {source}
              </RecipeActionRow>
            ))}
          </div>
        </div>

        <div className="border-border mt-5 border-t pt-4">
          <RecipeActionRow dashed onClick={continueInExistingCreateFlow}>
            Write it myself
          </RecipeActionRow>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
