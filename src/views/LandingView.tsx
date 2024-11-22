import { SignUpButton, SignedOut } from "@clerk/nextjs";

import { Button } from "../components/ui/button";

export const LandingView = () => {
  return (
    <main className="flex flex-grow flex-col items-center text-primary sm:justify-center">
      <div className="flex max-w-lg flex-col gap-8 p-4">
        <h1 className=" scroll-m-20 text-8xl font-extrabold tracking-tight ">
          Plan Eat Repeat
        </h1>

        <div className="flex flex-col gap-4">
          <p className="leading-7">
            PlanEatRepeat helps you effortlessly organize meals, plan your week,
            and bring your family together around the dinner table.
          </p>
          <p className="leading-7">
            When thinking about what to cook, do you ever struggle to remember
            what meals you cook, or perhaps even what food is?
          </p>
          <p className="leading-7">
            PlanEatRepeat makes it super simple and fast to manage your recipes,
            and plan the meals for your week with the whole household
            contributing.
          </p>

          <p className="leading-7">Sign in to plan your first week!</p>
        </div>
        <CTA />
      </div>
    </main>
  );
};

const CTA = () => {
  return (
    <SignedOut>
      <SignUpButton>
        <Button>Sign up</Button>
      </SignUpButton>
    </SignedOut>
  );
};
