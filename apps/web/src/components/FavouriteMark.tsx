import { cn } from "~/lib/utils";

const FavouriteHeart = ({ className }: { className?: string }) => (
  <svg
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 24 24"
    className={cn("shrink-0 fill-[#DD6B42]", className)}
  >
    <path d="M12 21s-8-4.9-8-10.4A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8 3.6C20 16.1 12 21 12 21z" />
  </svg>
);

export const FavouriteListMark = () => (
  <span className="inline-flex shrink-0 items-center">
    <FavouriteHeart className="size-[13px]" />
    <span className="sr-only">Favourite</span>
  </span>
);

export const FavouriteChip = () => (
  <span className="inline-flex h-6 shrink-0 items-center rounded-full border border-[#e7b9a4] bg-[#F6DDD2] px-2 py-[3px]">
    <FavouriteHeart className="size-3" />
    <span className="sr-only">Favourite</span>
  </span>
);
