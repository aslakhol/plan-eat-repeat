import { useState, useEffect } from "react";
import { format, addDays, subDays } from "date-fns";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { SignUpButton, SignedIn, SignedOut, useClerk } from "@clerk/nextjs";
import { api } from "../../utils/api";
import { useRouter } from "next/router";
import { toast } from "../../components/ui/use-toast";
import { Undo2 } from "lucide-react";

type OnboardingDinner = {
  name: string;
  date: Date;
};

const STORAGE_KEY = "onboarding_dinners";

const questionDates = (today: Date) => [
  today,
  subDays(today, 1),
  addDays(today, 1),
];

export const OnboardingView = () => {
  const [step, setStep] = useState(1);
  const [currentDinner, setCurrentDinner] = useState("");
  const [dinners, setDinners] = useState<OnboardingDinner[]>([]);
  const [householdName, setHouseholdName] = useState("");
  const today = new Date();
  const router = useRouter();
  const { user } = useClerk();

  // Load dinners from localStorage on mount
  useEffect(() => {
    const savedDinners = localStorage.getItem(STORAGE_KEY);
    if (savedDinners) {
      try {
        const parsed = JSON.parse(savedDinners) as {
          name: string;
          date: string;
        }[];
        const parsedDinners: OnboardingDinner[] = parsed.map((dinner) => ({
          name: dinner.name,
          date: new Date(dinner.date),
        }));
        setDinners(parsedDinners);
        if (parsedDinners.length >= 3) {
          setStep(2);
        }
      } catch (e) {
        console.error("Failed to parse saved dinners:", e);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const createHouseholdMutation = api.household.createHousehold.useMutation({
    onSuccess: async () => {
      localStorage.removeItem(STORAGE_KEY);
      await user?.reload();
      void router.push("/");
      toast({
        title: "Welcome to PlanEatRepeat!",
        description: "Your household has been created with your dinner plans.",
      });
    },
  });

  const handleSubmitDinner = () => {
    if (!currentDinner.trim()) return;

    const dates = questionDates(today);
    const newDinner: OnboardingDinner = {
      name: currentDinner,
      date: dates[dinners.length] ?? today,
    };

    const updatedDinners = [...dinners, newDinner];
    // Sort dinners chronologically
    const sortedDinners = updatedDinners.sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    );
    setDinners(sortedDinners);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sortedDinners));
    setCurrentDinner("");

    if (dinners.length === 2) {
      setStep(2);
    }
  };

  const handleCreateHousehold = () => {
    if (!householdName.trim()) return;

    const slug = householdName
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\w\-]+/g, "");

    createHouseholdMutation.mutate({
      name: householdName,
      slug,
      onboardingDinners: dinners,
    });
  };

  const handleReset = () => {
    setDinners([]);
    setCurrentDinner("");
    setStep(1);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Let&apos;s get started!</CardTitle>
            {dinners.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleReset}
                className="h-8 w-8"
              >
                <Undo2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          {step === 1 && (
            <CardDescription>
              Tell us about your dinner plans for the next few days
            </CardDescription>
          )}
          {step === 2 && (
            <CardDescription>
              Great! Now let&apos;s create your account to save these dinner
              plans
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="space-y-4">
              {dinners.map((dinner, index) => (
                <div
                  key={index}
                  className="flex h-auto w-full flex-col items-start rounded-md border p-4"
                >
                  <p className="text-xs font-normal">
                    {format(dinner.date, "EEE do")}
                  </p>
                  <div className="flex h-8 flex-col justify-end">
                    <p className="pb-2 font-semibold">{dinner.name}</p>
                  </div>
                </div>
              ))}
            </div>

            {step === 1 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {dinners.length === 0
                    ? "What are you having for dinner today?"
                    : dinners.length === 1
                    ? "What did you have for dinner yesterday?"
                    : "What are you having for dinner tomorrow?"}
                </p>
                <div className="flex gap-2">
                  <Input
                    value={currentDinner}
                    onChange={(e) => setCurrentDinner(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleSubmitDinner();
                      }
                    }}
                    placeholder="Enter dinner name"
                  />
                  <Button onClick={handleSubmitDinner}>Add</Button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <SignedIn>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        What would you like to call your household?
                      </p>
                      <Input
                        value={householdName}
                        onChange={(e) => setHouseholdName(e.target.value)}
                        placeholder="Enter household name"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && householdName.trim()) {
                            handleCreateHousehold();
                          }
                        }}
                      />
                    </div>
                    <Button
                      className="w-full"
                      onClick={handleCreateHousehold}
                      disabled={
                        !householdName.trim() ||
                        createHouseholdMutation.isLoading
                      }
                    >
                      {createHouseholdMutation.isLoading
                        ? "Creating your household..."
                        : "Create household"}
                    </Button>
                  </div>
                </SignedIn>
                <SignedOut>
                  <div className="space-y-4">
                    <SignUpButton mode="modal" forceRedirectUrl="/onboarding">
                      <Button className="w-full">Create Account</Button>
                    </SignUpButton>
                  </div>
                </SignedOut>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
};
