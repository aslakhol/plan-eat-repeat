import Head from "next/head";
import { PlanView } from "../views/Plan/PlanView";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { LandingView } from "../views/LandingView";

export default function Home() {
  return (
    <>
      <Head>
        <title>Sulten</title>
        <meta name="description" content="Dinner planning tool" />
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
