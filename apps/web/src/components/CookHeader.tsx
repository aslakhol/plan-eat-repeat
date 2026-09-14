import Link from "next/link";
import { Users } from "lucide-react";

import { Button } from "~/components/ui/button";

export const CookHeader = ({ title }: { title: string }) => (
  <div className="flex items-center justify-between gap-4">
    <h1 className="text-foreground font-serif text-3xl font-normal">{title}</h1>
    <Button
      asChild
      variant="outline"
      size="icon"
      className="size-9 shrink-0 rounded-full bg-white"
    >
      <Link href="/dinners/shared" aria-label="Open shared dinners">
        <Users className="size-4" />
      </Link>
    </Button>
  </div>
);
