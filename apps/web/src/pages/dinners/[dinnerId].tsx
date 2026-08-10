import Head from "next/head";
import { useRouter } from "next/router";
import { DinnerDetail } from "../../views/Dinners/DinnerDetail";
import { DinnersView } from "../../views/Dinners/DinnersView";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalTitle,
} from "../../components/ResponsiveModal";

export default function DinnerDetailPage() {
  const router = useRouter();

  return (
    <>
      <Head>
        <title>Dinner · PlanEatRepeat</title>
        <meta name="description" content="View and edit a dinner recipe" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <DinnersView />
      <ResponsiveModal
        open
        onOpenChange={(open) => {
          if (!open) void router.replace("/dinners");
        }}
      >
        <ResponsiveModalContent className="h-[min(92dvh,760px)] max-h-[92dvh] overflow-y-auto bg-white md:max-w-[680px]">
          <ResponsiveModalTitle className="sr-only">
            Dinner details
          </ResponsiveModalTitle>
          <ResponsiveModalDescription className="sr-only">
            View or edit this Dinner from the Cookbook.
          </ResponsiveModalDescription>
          <DinnerDetail />
        </ResponsiveModalContent>
      </ResponsiveModal>
    </>
  );
}
