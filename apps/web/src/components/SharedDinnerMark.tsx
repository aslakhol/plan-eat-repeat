import { Users } from "lucide-react";

const SharedDinnerIcon = ({ className }: { className?: string }) => (
  <Users aria-hidden="true" focusable="false" className={className} />
);

export const SharedDinnerListMark = () => (
  <span className="inline-flex shrink-0 items-center">
    <SharedDinnerIcon className="text-primary size-[13px] stroke-[2.25]" />
    <span className="sr-only">Shared publicly</span>
  </span>
);

export const SharedDinnerChip = () => (
  <span className="border-primary/30 bg-primary/10 inline-flex h-6 shrink-0 items-center gap-1 rounded-full border px-2.5 py-[3px]">
    <SharedDinnerIcon className="text-primary size-3 -translate-y-px stroke-[2.25]" />
    <span className="text-primary text-xs font-semibold leading-none">
      Shared
    </span>
  </span>
);
