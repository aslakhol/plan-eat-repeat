import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect } from "react";

import { Button } from "~/components/ui/button";

export const PublishedDinnerUnavailable = () => {
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady || router.query.save !== "1") return;
    const query = { ...router.query };
    delete query.save;
    void router.replace({ pathname: router.pathname, query }, undefined, {
      shallow: true,
    });
  }, [router]);

  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="text-primary font-serif text-lg">Plan Eat Repeat</p>
        <h1 className="mt-4 font-serif text-3xl font-normal">
          This dinner is no longer shared
        </h1>
        <p className="text-muted-foreground mt-3 text-sm font-semibold">
          Sharing may have been stopped or the Dinner may have been deleted.
        </p>
        <Button asChild className="mt-6" variant="outline">
          <Link href="/">Continue to Plan Eat Repeat</Link>
        </Button>
      </div>
    </main>
  );
};
