import { useId, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { IMPORT_PROMPT_MAX_LENGTH } from "@planeatrepeat/shared";

import { DetailsMenu } from "~/components/ui/details-menu";
import { cn } from "~/lib/utils";

type Props = {
  prompt: string;
  remember: boolean;
  householdPrompt: string;
  systemDefaultPrompt: string;
  onPromptChange: (prompt: string) => void;
  onRememberChange: (remember: boolean) => void;
};

export function ImportPrompt({
  prompt,
  remember,
  householdPrompt,
  systemDefaultPrompt,
  onPromptChange,
  onRememberChange,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const resetMenu = useRef<HTMLDetailsElement>(null);
  const contentId = useId();
  const switchId = useId();
  const changed = prompt !== householdPrompt;

  useLayoutEffect(() => {
    if (!expanded || !textarea.current) return;
    textarea.current.style.height = "0px";
    textarea.current.style.height = `${Math.min(textarea.current.scrollHeight, 320)}px`;
  }, [expanded, prompt]);

  const reset = (value: string) => {
    onPromptChange(value);
    resetMenu.current?.removeAttribute("open");
    resetMenu.current?.querySelector("summary")?.focus();
  };

  return (
    <section
      aria-label="Import prompt"
      className={cn(
        "rounded-xl border-[1.5px] bg-white",
        changed ? "border-primary" : "border-border",
      )}
    >
      <div className="relative">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => setExpanded(!expanded)}
          className={cn(
            "focus-visible:outline-primary flex w-full items-center justify-between rounded-xl px-4 py-3.5 text-sm font-bold focus-visible:outline focus-visible:outline-2",
            changed && "text-primary",
          )}
        >
          Prompt
          <ChevronDown
            aria-hidden="true"
            className={cn("size-4", expanded && "rotate-180")}
          />
        </button>
        <DetailsMenu
          ref={resetMenu}
          className="absolute right-10 top-0 z-10"
          onToggle={(event) => setResetOpen(event.currentTarget.open)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && event.currentTarget.open) {
              event.stopPropagation();
              event.currentTarget.removeAttribute("open");
              event.currentTarget.querySelector("summary")?.focus();
            }
          }}
        >
          <summary className="text-primary flex cursor-pointer list-none items-center gap-1 px-2 py-3.5 text-xs font-bold [&::-webkit-details-marker]:hidden">
            Reset{" "}
            <ChevronDown
              aria-hidden="true"
              className={cn("size-3", resetOpen && "rotate-180")}
            />
          </summary>
          <div className="border-border absolute right-0 top-full w-48 overflow-hidden rounded-xl border bg-white shadow-lg">
            <button
              type="button"
              onClick={() => reset(householdPrompt)}
              className="hover:bg-muted w-full px-4 py-3 text-left text-sm font-semibold"
            >
              Reset to household
            </button>
            <button
              type="button"
              onClick={() => reset(systemDefaultPrompt)}
              className="border-border hover:bg-muted w-full border-t px-4 py-3 text-left text-sm font-semibold"
            >
              Reset to app default
            </button>
          </div>
        </DetailsMenu>
      </div>
      <div id={contentId} hidden={!expanded} className="border-border border-t">
        <textarea
          ref={textarea}
          aria-label="Import Prompt"
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          maxLength={IMPORT_PROMPT_MAX_LENGTH}
          rows={3}
          className={cn(
            "focus-visible:ring-primary/30 block max-h-[40dvh] min-h-24 w-full resize-none overflow-y-auto border-0 bg-transparent px-4 py-3 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset",
            resetOpen && "opacity-50",
          )}
        />
        <div className="border-border flex items-center justify-between gap-3 border-t px-4 py-3">
          <label
            htmlFor={switchId}
            className="text-muted-foreground cursor-pointer text-sm font-semibold"
          >
            Remember prompt
          </label>
          <button
            id={switchId}
            type="button"
            role="switch"
            aria-checked={remember}
            onClick={() => onRememberChange(!remember)}
            className={cn(
              "focus-visible:ring-ring relative h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
              remember ? "bg-primary" : "bg-muted-foreground/30",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "absolute top-0.5 size-4 rounded-full bg-white transition-transform",
                remember ? "left-0.5 translate-x-4" : "left-0.5",
              )}
            />
          </button>
        </div>
      </div>
    </section>
  );
}
