import Head from "next/head";
import { OnboardingView } from "../views/Onboarding/OnboardingView";

export default function Onboarding() {
  return (
    <>
      <Head>
        <title>PlanEatRepeat</title>
        <meta name="description" content="The easiest way to plan dinners" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <OnboardingView />
    </>
  );
}
