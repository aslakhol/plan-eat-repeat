import Head from "next/head";
import { PlanView } from "../views/Plan/PlanView";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { LandingView } from "../views/LandingView";

export default function Home() {
  return (
    <>
      <Head>
        <title>PlanEatRepeat</title>
        <meta name="description" content="The easiest way to plan dinners" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <SignedIn>
        <PlanView />
      </SignedIn>
      <SignedOut>
        <LandingView />
      </SignedOut>
    </>
  );
}
