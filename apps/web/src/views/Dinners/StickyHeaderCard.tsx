import type { HTMLAttributes } from "react";

import { cn } from "~/lib/utils";

type Props = HTMLAttributes<HTMLElement> & {
  as?: "div" | "nav";
};

export const StickyHeaderCard = ({
  as: Component = "div",
  className,
  ...props
}: Props) => (
  <Component
    className={cn(
      "border-border -mx-1 rounded-b-lg border bg-white/95 px-3 py-2 shadow-sm backdrop-blur",
      className,
    )}
    {...props}
  />
);
