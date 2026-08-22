import Link from "next/link";
import React from "react";

import { Button } from "~/components/ui/button";

export const PublicDinnerListUnavailable = () => (
  <main className="bg-background flex min-h-screen items-center justify-center px-6">
    <div className="max-w-md text-center">
      <p className="text-primary font-serif text-lg">Plan Eat Repeat</p>
      <h1 className="mt-4 font-serif text-3xl font-normal">
        This page is no longer shared
      </h1>
      <p className="text-muted-foreground mt-3 text-sm font-semibold">
        This Household may have stopped sharing its Dinners.
      </p>
      <Button asChild className="mt-6" variant="outline">
        <Link href="/">Continue to Plan Eat Repeat</Link>
      </Button>
    </div>
  </main>
);
