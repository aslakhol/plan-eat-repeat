import { SignInButton, SignedOut } from "@clerk/nextjs";
import { Button } from "../components/ui/button";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { UtensilsCrossed, Calendar, Users } from "lucide-react";

export const LandingView = () => {
  return (
    <main className="flex min-h-[80vh] flex-col items-center justify-center gap-12 py-12 text-center">
      <div className="flex max-w-2xl flex-col items-center gap-6">
        <h1 className="font-serif text-5xl font-bold tracking-tight text-foreground sm:text-7xl">
          Plan. Eat. Repeat.
        </h1>
        <p className="text-lg text-muted-foreground sm:text-xl">
          Effortlessly organize meals, plan your week, and bring your family
          together around the dinner table.
        </p>
        <CTA />
      </div>

      <div className="grid w-full max-w-5xl grid-cols-1 gap-6 sm:grid-cols-3">
        <FeatureCard
          icon={<UtensilsCrossed className="h-8 w-8 text-primary" />}
          title="Organize Recipes"
          description="Keep track of your favorite meals. Never wonder 'what can we cook?' again."
        />
        <FeatureCard
          icon={<Calendar className="h-8 w-8 text-primary" />}
          title="Plan Your Week"
          description="Simple drag-and-drop planning for the week ahead. Coordinate with your household."
        />
        <FeatureCard
          icon={<Users className="h-8 w-8 text-primary" />}
          title="Collaborate"
          description="Invite family members to contribute. Everyone knows what's for dinner."
        />
      </div>
    </main>
  );
};

const FeatureCard = ({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) => {
  return (
    <Card className="flex flex-col items-center text-center transition-colors hover:bg-accent/50">
      <CardHeader className="flex flex-col items-center gap-4 pb-2">
        <div className="rounded-full bg-primary/10 p-4">{icon}</div>
        <CardTitle className="font-serif text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
};

const CTA = () => {
  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <SignedOut>
        <Button size="lg" className="text-lg" asChild>
          <Link href="/onboarding">Get started</Link>
        </Button>
        <SignInButton mode="modal">
          <Button variant="outline" size="lg" className="text-lg">
            Sign in
          </Button>
        </SignInButton>
      </SignedOut>
    </div>
  );
};
