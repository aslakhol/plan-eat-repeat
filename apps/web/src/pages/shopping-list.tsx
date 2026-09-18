import { SignedIn, SignedOut } from "@clerk/nextjs";
import Head from "next/head";
import { ShoppingReady } from "~/views/ShoppingList/ShoppingProvider";
import { LandingView } from "~/views/LandingView";
import { ShoppingListView } from "~/views/ShoppingList/ShoppingListView";

export default function ShoppingListPage() {
  return (
    <>
      <Head>
        <title>Shopping list · PlanEatRepeat</title>
      </Head>
      <SignedIn>
        <ShoppingReady>
          <ShoppingListView />
        </ShoppingReady>
      </SignedIn>
      <SignedOut>
        <LandingView />
      </SignedOut>
    </>
  );
}
