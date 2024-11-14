import Head from "next/head";
import { PlanView } from "../views/Plan/PlanView";
import { SignInButton } from "@clerk/nextjs";
import { Button } from "../components/ui/button";
import { SignedOut } from "@clerk/nextjs";
import { cn } from "../lib/utils";

export default function Landing() {
  return (
    <>
      <Head>
        <title>Sulten</title>
        <meta name="description" content="Dinner planning tool" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="flex flex-grow flex-col items-center text-primary sm:justify-center">
        <div className="flex max-w-lg flex-col gap-8 p-4">
          <h1 className=" scroll-m-20 text-8xl font-extrabold tracking-tight ">
            Sulten
          </h1>

          <div className="flex flex-col gap-4">
            <p className="leading-7">
              Sulten helps you effortlessly organize meals, plan your week, and
              bring your family together around the dinner table.
            </p>
            <p className="leading-7">
              When thinking about what to cook, do you ever struggle to remember
              what meals you cook, or perhaps even what food is?
            </p>
            <p className="leading-7">
              Sulten makes it super simple and fast to manage your recipies, and
              plan the meals for your week with the whole household
              contributing.
            </p>

            <p className="leading-7">Sign in to plan your first week!</p>
          </div>
          <CTA />
        </div>
      </main>
    </>
  );
}

const CTA = () => {
  return (
    <SignedOut>
      <SignInButton>
        <Button>Sign in</Button>
      </SignInButton>
    </SignedOut>
  );
};
