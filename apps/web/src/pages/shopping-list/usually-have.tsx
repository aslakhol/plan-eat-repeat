import { SignedIn, SignedOut } from "@clerk/nextjs";
import Head from "next/head";
import { ShoppingReady } from "~/views/ShoppingList/ShoppingProvider";
import { LandingView } from "~/views/LandingView";
import { UsuallyHaveView } from "~/views/ShoppingList/UsuallyHaveView";

export default function UsuallyHavePage() {
  return (
    <>
      <Head>
        <title>Usually have · PlanEatRepeat</title>
      </Head>
      <SignedIn>
        <ShoppingReady>
          <UsuallyHaveView />
        </ShoppingReady>
      </SignedIn>
      <SignedOut>
        <LandingView />
      </SignedOut>
    </>
  );
}
