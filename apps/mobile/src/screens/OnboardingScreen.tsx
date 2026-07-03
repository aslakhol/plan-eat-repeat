import * as React from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSession, useUser } from "@clerk/clerk-expo";
import * as SecureStore from "expo-secure-store";
import { addDays, format, startOfDay, subDays } from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Screen } from "../components/Screen";
import { colors } from "../theme/colors";
import { api } from "../utils/api";

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

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

export function OnboardingScreen() {
  const utils = api.useUtils();
  const { session } = useSession();
  const { user } = useUser();
  const [currentDinner, setCurrentDinner] = React.useState("");
  const [dinners, setDinners] = React.useState<OnboardingDinner[]>([]);
  const [householdName, setHouseholdName] = React.useState("");
  const [inviteLink, setInviteLink] = React.useState("");
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [joinError, setJoinError] = React.useState<string | null>(null);
  const [isRestoring, setIsRestoring] = React.useState(true);
  const today = React.useMemo(() => startOfDay(new Date()), []);
  const storageKey = user ? `${STORAGE_KEY}:${user.id}` : null;

  React.useEffect(() => {
    if (!storageKey) return;

    let isMounted = true;
    setIsRestoring(true);

    const restoreDinners = async () => {
      try {
        const storedForUser = await SecureStore.getItemAsync(storageKey);
        const legacyDinners = storedForUser
          ? null
          : await SecureStore.getItemAsync(STORAGE_KEY);
        const savedDinners = storedForUser ?? legacyDinners;
        if (!savedDinners || !isMounted) return;

        if (legacyDinners) {
          await Promise.allSettled([
            SecureStore.setItemAsync(storageKey, legacyDinners),
            SecureStore.deleteItemAsync(STORAGE_KEY),
          ]);
        }

        const parsed = JSON.parse(savedDinners) as unknown;
        if (!Array.isArray(parsed)) {
          await SecureStore.deleteItemAsync(storageKey);
          return;
        }

        const restoredDinners = parsed
          .filter(
            (dinner): dinner is { name: string; date: string } =>
              typeof dinner === "object" &&
              dinner !== null &&
              typeof dinner.name === "string" &&
              typeof dinner.date === "string",
          )
          .map((dinner) => ({
            name: dinner.name,
            date: startOfDay(new Date(dinner.date)),
          }))
          .filter((dinner) => !Number.isNaN(dinner.date.getTime()))
          .slice(0, 3)
          .sort((a, b) => a.date.getTime() - b.date.getTime());

        setDinners(restoredDinners);
      } catch {
        await Promise.allSettled([
          SecureStore.deleteItemAsync(storageKey),
          SecureStore.deleteItemAsync(STORAGE_KEY),
        ]);
      } finally {
        if (isMounted) setIsRestoring(false);
      }
    };

    void restoreDinners();

    return () => {
      isMounted = false;
    };
  }, [storageKey]);

  const clearStoredDinners = () =>
    Promise.allSettled([
      ...(storageKey ? [SecureStore.deleteItemAsync(storageKey)] : []),
      SecureStore.deleteItemAsync(STORAGE_KEY),
    ]);

  const createHouseholdMutation = api.household.createHousehold.useMutation({
    async onSuccess(data) {
      utils.household.household.setData(undefined, {
        household: data.household,
      });
      await Promise.allSettled([
        clearStoredDinners(),
        session ? session.reload() : Promise.resolve(),
        utils.household.household.invalidate(),
      ]);
    },
    onError(err) {
      setCreateError(err.message);
      void utils.household.household.invalidate();
    },
  });

  const joinHouseholdMutation = api.household.join.useMutation({
    async onSuccess() {
      await Promise.allSettled([
        clearStoredDinners(),
        session ? session.reload() : Promise.resolve(),
        utils.household.household.invalidate(),
      ]);
    },
    onError(err) {
      setJoinError(err.message);
      void utils.household.household.invalidate();
    },
  });

  const isCreatingOrJoining =
    createHouseholdMutation.isPending || joinHouseholdMutation.isPending;
  const isDinnerStep = dinners.length < 3;
  const trimmedHouseholdName = householdName.trim();
  const canSubmit =
    !isDinnerStep && trimmedHouseholdName.length > 0 && !isCreatingOrJoining;
  const parsedInviteId = parseInviteId(inviteLink);
  const canJoin = !!parsedInviteId && !isCreatingOrJoining;

  const onAddDinner = () => {
    const trimmedDinner = currentDinner.trim();
    if (!trimmedDinner || !isDinnerStep) return;

    const dates = questionDates(today);
    const updatedDinners = [
      ...dinners,
      {
        name: trimmedDinner,
        date: dates[dinners.length] ?? today,
      },
    ].sort((a, b) => a.date.getTime() - b.date.getTime());

    setDinners(updatedDinners);
    setCurrentDinner("");
    if (storageKey) {
      void SecureStore.setItemAsync(
        storageKey,
        JSON.stringify(updatedDinners),
      ).catch(() => undefined);
    }
  };

  const onReset = () => {
    setDinners([]);
    setCurrentDinner("");
    setCreateError(null);
    void clearStoredDinners();
  };

  const onCreateHousehold = () => {
    if (!canSubmit) return;

    setCreateError(null);
    createHouseholdMutation.mutate({
      name: trimmedHouseholdName,
      slug: slugify(trimmedHouseholdName),
      onboardingDinners: dinners,
    });
  };

  const onJoinHousehold = () => {
    if (!parsedInviteId || !canJoin) return;

    setJoinError(null);
    joinHouseholdMutation.mutate({ inviteId: parsedInviteId });
  };

  if (isRestoring) {
    return (
      <Screen contentClassName="items-center justify-center">
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            paddingVertical: 24,
          }}
        >
          <View className="gap-6">
            <View className="gap-2">
              <Text className="text-foreground font-serif text-4xl">
                Let&apos;s get started!
              </Text>
              <Text className="text-muted-foreground text-base leading-6">
                {isDinnerStep
                  ? "To get going, we’ll set up some dinner plans for you."
                  : "Great! Now let’s create your household."}
              </Text>
            </View>

            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>
                  {isDinnerStep ? "Plan your first dinners" : "Your dinners"}
                </CardTitle>
                {dinners.length > 0 && (
                  <Button variant="ghost" size="sm" onPress={onReset}>
                    Start over
                  </Button>
                )}
              </CardHeader>
              <CardContent className="gap-4">
                {dinners.map((dinner) => (
                  <View
                    key={dinner.date.toISOString()}
                    className="border-border gap-1 rounded-md border p-3"
                  >
                    <Text className="text-muted-foreground text-xs">
                      {format(dinner.date, "EEE do")}
                    </Text>
                    <Text className="text-foreground font-sans text-base font-semibold">
                      {dinner.name}
                    </Text>
                  </View>
                ))}

                {isDinnerStep ? (
                  <View className="gap-2">
                    <Text className="text-muted-foreground text-sm">
                      {dinners.length === 0
                        ? "What are you having for dinner today?"
                        : dinners.length === 1
                          ? "What did you have for dinner yesterday?"
                          : "What are you having for dinner tomorrow?"}
                    </Text>
                    <View className="flex-row gap-2">
                      <Input
                        className="flex-1"
                        value={currentDinner}
                        onChangeText={setCurrentDinner}
                        placeholder="Enter dinner name"
                        autoCapitalize="sentences"
                        returnKeyType="next"
                        onSubmitEditing={onAddDinner}
                      />
                      <Button
                        disabled={!currentDinner.trim()}
                        onPress={onAddDinner}
                      >
                        Add
                      </Button>
                    </View>
                  </View>
                ) : (
                  <View className="gap-4">
                    <View className="gap-2">
                      <Text className="text-muted-foreground text-sm">
                        What would you like to call your household?
                      </Text>
                      <Input
                        value={householdName}
                        onChangeText={setHouseholdName}
                        placeholder="The Dinner Club"
                        autoCapitalize="words"
                        autoCorrect={false}
                        returnKeyType="done"
                        onSubmitEditing={onCreateHousehold}
                        editable={!isCreatingOrJoining}
                      />
                    </View>
                    <Button disabled={!canSubmit} onPress={onCreateHousehold}>
                      {createHouseholdMutation.isPending ? (
                        <>
                          <ActivityIndicator color={colors.primaryForeground} />
                          <Text className="text-primary-foreground font-sans text-sm font-medium">
                            Creating your household...
                          </Text>
                        </>
                      ) : (
                        "Create household"
                      )}
                    </Button>
                    {createError && (
                      <Text className="text-destructive text-sm">
                        {createError}
                      </Text>
                    )}
                  </View>
                )}
              </CardContent>
            </Card>

            <View className="border-border bg-card gap-3 rounded-lg border p-4">
              <View className="gap-1">
                <Text className="text-foreground font-sans text-base font-semibold">
                  Have an invite?
                </Text>
                <Text className="text-muted-foreground text-sm leading-5">
                  Paste your invite link or invite code to join an existing
                  household instead.
                </Text>
              </View>
              <Input
                value={inviteLink}
                onChangeText={setInviteLink}
                placeholder="planeatrepeat.com/invite/..."
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="go"
                onSubmitEditing={onJoinHousehold}
                editable={!isCreatingOrJoining}
              />
              <Button
                variant="outline"
                disabled={!canJoin}
                onPress={onJoinHousehold}
              >
                {joinHouseholdMutation.isPending
                  ? "Joining..."
                  : "Join household"}
              </Button>
              {joinError && (
                <Text className="text-destructive text-sm">{joinError}</Text>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const parseInviteId = (value: string) => {
  const trimmedValue = value.trim();
  if (!trimmedValue) return null;

  const invitePathMatch = trimmedValue.match(/(?:^|\/)invite\/([^/?#]+)/i);
  if (invitePathMatch?.[1]) {
    try {
      return decodeURIComponent(invitePathMatch[1]);
    } catch {
      return invitePathMatch[1];
    }
  }

  return trimmedValue;
};
