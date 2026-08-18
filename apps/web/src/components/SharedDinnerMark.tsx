import { Link2 } from "lucide-react";

const SharedDinnerLink = ({ className }: { className?: string }) => (
  <Link2 aria-hidden="true" focusable="false" className={className} />
);

export const SharedDinnerListMark = () => (
  <span className="inline-flex shrink-0 items-center">
    <SharedDinnerLink className="text-primary size-[13px] stroke-[2.25]" />
    <span className="sr-only">Shared publicly</span>
  </span>
);

export const SharedDinnerChip = () => (
  <span className="border-primary/30 bg-primary/10 inline-flex h-6 shrink-0 items-center rounded-full border px-2 py-[3px]">
    <SharedDinnerLink className="text-primary size-3 stroke-[2.25]" />
    <span className="sr-only">Shared publicly</span>
  </span>
);
