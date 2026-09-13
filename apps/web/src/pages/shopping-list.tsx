import { SignedIn, SignedOut } from "@clerk/nextjs";
import Head from "next/head";
import { LandingView } from "~/views/LandingView";
import { ShoppingListView } from "~/views/ShoppingList/ShoppingListView";

export default function ShoppingListPage() {
  return (
    <>
      <Head>
        <title>Shopping list · PlanEatRepeat</title>
      </Head>
      <SignedIn>
        <ShoppingListView />
      </SignedIn>
      <SignedOut>
        <LandingView />
      </SignedOut>
    </>
  );
}
