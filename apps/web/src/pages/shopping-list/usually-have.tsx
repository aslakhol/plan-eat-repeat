import { SignedIn, SignedOut } from "@clerk/nextjs";
import Head from "next/head";
import { LandingView } from "~/views/LandingView";
import { UsuallyHaveView } from "~/views/ShoppingList/UsuallyHaveView";

export default function UsuallyHavePage() {
  return (
    <>
      <Head>
        <title>Usually have · PlanEatRepeat</title>
      </Head>
      <SignedIn>
        <UsuallyHaveView />
      </SignedIn>
      <SignedOut>
        <LandingView />
      </SignedOut>
    </>
  );
}
