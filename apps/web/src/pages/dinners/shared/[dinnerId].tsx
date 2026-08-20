import Head from "next/head";
import { useRouter } from "next/router";

import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalTitle,
} from "~/components/ResponsiveModal";
import { SharedDinnerDetail } from "~/views/Dinners/SharedDinnerDetail";
import { SharedDinnersView } from "~/views/Dinners/SharedDinnersView";

export default function SharedDinnerDetailPage() {
  const router = useRouter();

  return (
    <>
      <Head>
        <title>Shared dinner · PlanEatRepeat</title>
        <meta name="description" content="Manage a publicly shared dinner" />
      </Head>
      <SharedDinnersView />
      <ResponsiveModal
        open
        onOpenChange={(open) => {
          if (!open) void router.replace("/dinners/shared");
        }}
      >
        <ResponsiveModalContent className="h-auto max-h-[92dvh] bg-white md:max-w-lg">
          <ResponsiveModalTitle className="sr-only">
            Shared dinner details
          </ResponsiveModalTitle>
          <ResponsiveModalDescription className="sr-only">
            Copy the public link, open the Dinner, or stop sharing it.
          </ResponsiveModalDescription>
          <SharedDinnerDetail />
        </ResponsiveModalContent>
      </ResponsiveModal>
    </>
  );
}
