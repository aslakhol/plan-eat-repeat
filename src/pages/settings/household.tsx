import Head from "next/head";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { LandingView } from "../../views/LandingView";
import { HouseholdView } from "../../views/Settings/HouseholdView";
import { api } from "../../utils/api";

export default function Home() {
  const utils = api.useUtils();
  const householdsForUserQuery = api.household.householdsForUser.useQuery();
  void utils.household.members.prefetch({
    householdId: householdsForUserQuery.data?.households[0]?.id ?? "",
  });
  return (
    <>
      <Head>
        <title>Sulten</title>
        <meta name="description" content="Dinner planning tool" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <SignedIn>
        <HouseholdView
          currentHousehold={householdsForUserQuery.data?.households[0]}
        />
      </SignedIn>
      <SignedOut>
        <LandingView />
      </SignedOut>
    </>
  );
}
