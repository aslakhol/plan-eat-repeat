import Head from "next/head";
import { SignedIn, SignedOut, useClerk } from "@clerk/nextjs";
import { LandingView } from "../../views/LandingView";
import { HouseholdView } from "../../views/Settings/HouseholdView";
import { api } from "../../utils/api";
import { UtensilsCrossed } from "lucide-react";

export default function HouseholdSettings() {
  const { user } = useClerk();
  const utils = api.useUtils();
  const householdQuery = api.household.household.useQuery();
  void utils.household.members.prefetch({
    householdId: user?.publicMetadata.householdId ?? "",
  });

  if (householdQuery.isLoading) {
    return (
      <>
        <Head>
          <title>PlanEatRepeat</title>
          <meta name="description" content="The easiest way to plan dinners" />
          <link rel="icon" href="/favicon.ico" />
        </Head>
        <div className="flex h-screen w-screen items-center justify-center">
          <UtensilsCrossed className="animate-spin" />
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>PlanEatRepeat</title>
        <meta name="description" content="The easiest way to plan dinners" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <SignedIn>
        {householdQuery.isSuccess && (
          <HouseholdView household={householdQuery.data?.household} />
        )}
      </SignedIn>
      <SignedOut>
        <LandingView />
      </SignedOut>
    </>
  );
}
