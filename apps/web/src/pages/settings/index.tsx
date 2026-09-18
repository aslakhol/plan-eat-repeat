import Head from "next/head";
import { useClerk, SignedIn, SignedOut } from "@clerk/nextjs";
import { LoadingIndicator } from "~/components/LoadingIndicator";
import { api } from "../../utils/api";
import { LandingView } from "../../views/LandingView";
import { SettingsView } from "../../views/Settings/SettingsView";

export default function Settings() {
  const { user } = useClerk();
  const utils = api.useUtils();
  const householdQuery = api.household.household.useQuery();
  void utils.household.members.prefetch({
    householdId: user?.publicMetadata.householdId ?? "",
  });

  if (householdQuery.isPending) {
    return (
      <>
        <Head>
          <title>PlanEatRepeat</title>
          <meta name="description" content="The easiest way to plan dinners" />
          <link rel="icon" href="/favicon.ico" />
        </Head>
        <LoadingIndicator
          label="Loading settings…"
          className="h-[50vh] w-full"
        />
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
          <SettingsView
            household={householdQuery.data.household}
            systemDefaultPrompt={householdQuery.data.systemDefaultPrompt}
          />
        )}
      </SignedIn>
      <SignedOut>
        <LandingView />
      </SignedOut>
    </>
  );
}
