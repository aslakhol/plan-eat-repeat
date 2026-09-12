import * as React from "react";
import {
  Alert,
  BackHandler,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useClerk, useUser } from "@clerk/clerk-expo";
import { LogOut } from "lucide-react-native";
import { Screen } from "../components/Screen";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/Card";
import { api } from "../utils/api";
import { colors } from "../theme/colors";
import { IMPORT_PROMPT_MAX_LENGTH } from "@planeatrepeat/shared";
import {
  useFocusEffect,
  useNavigation,
  usePreventRemove,
} from "@react-navigation/native";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../utils/api";
import { Textarea } from "../components/ui/Textarea";

const confirmDiscard = (discard: () => void) =>
  Alert.alert("Discard unsaved prompt changes?", undefined, [
    { text: "Keep editing", style: "cancel" },
    { text: "Discard", style: "destructive", onPress: discard },
  ]);

type SettingsProps = {
  leaveGuard: React.RefObject<((leave: () => void) => void) | null>;
};

export function SettingsScreen({ leaveGuard }: SettingsProps) {
  const householdQuery = api.household.household.useQuery();
  const { user } = useUser();
  if (householdQuery.isError && !householdQuery.data)
    return (
      <Screen>
        <Text>Couldn't load settings</Text>
        <Button
          onPress={() => {
            void householdQuery.refetch();
          }}
        >
          <Text>Try again</Text>
        </Button>
      </Screen>
    );
  if (!householdQuery.data)
    return (
      <Screen>
        <Text>Loading settings...</Text>
      </Screen>
    );
  return (
    <SettingsContent
      key={`${user?.id}:${householdQuery.data.household?.id}`}
      data={householdQuery.data}
      leaveGuard={leaveGuard}
    />
  );
}

function SettingsContent({
  data,
  leaveGuard,
}: SettingsProps & {
  data: inferRouterOutputs<AppRouter>["household"]["household"];
}) {
  const { signOut } = useClerk();
  const { user } = useUser();
  const [isSigningOut, setIsSigningOut] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const { household, systemDefaultPrompt } = data;
  const [savedPrompt, setSavedPrompt] = React.useState(
    household?.importInstructions ?? systemDefaultPrompt,
  );
  const [importInstructions, setImportInstructions] =
    React.useState(savedPrompt);
  const dirty = importInstructions !== savedPrompt;
  const navigation = useNavigation();
  usePreventRemove(dirty, ({ data: action }) =>
    confirmDiscard(() => navigation.dispatch(action.action)),
  );
  useFocusEffect(
    React.useCallback(() => {
      if (!dirty) return;
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          confirmDiscard(() => {
            setImportInstructions(savedPrompt);
            if (navigation.canGoBack()) navigation.goBack();
            else BackHandler.exitApp();
          });
          return true;
        },
      );
      return () => subscription.remove();
    }, [dirty, savedPrompt, navigation]),
  );
  React.useEffect(() => {
    if (!dirty) return;
    leaveGuard.current = (leave) => {
      confirmDiscard(() => {
        setImportInstructions(savedPrompt);
        leave();
      });
    };
    return () => {
      leaveGuard.current = null;
    };
  }, [dirty, savedPrompt, leaveGuard]);
  const [importInstructionsError, setImportInstructionsError] = React.useState<
    string | null
  >(null);

  const utils = api.useUtils();
  const membersQuery = api.household.members.useQuery(
    { householdId: household?.id ?? "" },
    { enabled: !!household },
  );
  const updateHouseholdMutation = api.household.updateHousehold.useMutation({
    onSuccess: async ({ household: saved }) => {
      const prompt = saved.importInstructions ?? systemDefaultPrompt;
      setSavedPrompt(prompt);
      setImportInstructions(prompt);
      setImportInstructionsError(null);
      await utils.household.household.invalidate();
    },
    onError: (mutationError) => {
      setImportInstructionsError(mutationError.message);
    },
  });

  const onSignOut = async () => {
    try {
      setError(null);
      setIsSigningOut(true);
      await signOut();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign out");
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <Screen edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="gap-4 pb-8"
        >
          <Text className="text-foreground font-serif text-3xl">Settings</Text>

          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
            </CardHeader>
            <CardContent className="gap-4">
              <View className="flex-row items-center gap-3">
                {user?.imageUrl ? (
                  <Image
                    source={{ uri: user.imageUrl }}
                    className="h-12 w-12 rounded-full"
                  />
                ) : (
                  <View className="bg-secondary h-12 w-12 items-center justify-center rounded-full">
                    <Text className="text-secondary-foreground text-base font-semibold">
                      {user?.firstName?.[0] ?? "?"}
                    </Text>
                  </View>
                )}
                <View className="flex-1">
                  <Text className="text-foreground text-base font-medium">
                    {[user?.firstName, user?.lastName]
                      .filter(Boolean)
                      .join(" ")}
                  </Text>
                  <Text className="text-muted-foreground text-sm">
                    {user?.primaryEmailAddress?.emailAddress}
                  </Text>
                </View>
              </View>
              <Button
                variant="outline"
                onPress={() => {
                  if (dirty)
                    confirmDiscard(() => {
                      void onSignOut();
                    });
                  else void onSignOut();
                }}
                disabled={isSigningOut}
                className="justify-center"
              >
                <LogOut size={16} color={colors.foreground} />
                <Text className="text-foreground font-sans text-sm font-medium">
                  {isSigningOut ? "Signing out..." : "Sign Out"}
                </Text>
              </Button>
              {error && (
                <Text className="text-destructive text-sm">{error}</Text>
              )}
            </CardContent>
          </Card>

          {household && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Recipe imports</CardTitle>
                </CardHeader>
                <CardContent className="gap-3">
                  <Text className="text-foreground text-base font-medium">
                    Household Prompt
                  </Text>
                  <Textarea
                    value={importInstructions}
                    onChangeText={setImportInstructions}
                    maxLength={IMPORT_PROMPT_MAX_LENGTH}
                    editable={!updateHouseholdMutation.isPending}
                    className="h-80 max-h-80"
                    scrollEnabled
                  />
                  <View className="flex-row flex-wrap gap-2">
                    <Button
                      variant="outline"
                      disabled={updateHouseholdMutation.isPending}
                      onPress={() =>
                        setImportInstructions(
                          household.importInstructions ?? systemDefaultPrompt,
                        )
                      }
                    >
                      <Text>Reset to household</Text>
                    </Button>
                    <Button
                      variant="outline"
                      disabled={updateHouseholdMutation.isPending}
                      onPress={() => setImportInstructions(systemDefaultPrompt)}
                    >
                      <Text>Reset to app default</Text>
                    </Button>
                  </View>
                  <Button
                    disabled={updateHouseholdMutation.isPending}
                    onPress={() => {
                      setImportInstructionsError(null);
                      updateHouseholdMutation.mutate({
                        importInstructions,
                      });
                    }}
                  >
                    <Text className="text-primary-foreground font-semibold">
                      {updateHouseholdMutation.isPending
                        ? "Saving…"
                        : "Save prompt"}
                    </Text>
                  </Button>
                  {importInstructionsError && (
                    <Text className="text-destructive text-sm">
                      {importInstructionsError}
                    </Text>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Household</CardTitle>
                </CardHeader>
                <CardContent className="gap-4">
                  <Text className="text-foreground text-base">
                    {household.name}
                  </Text>
                  <View className="gap-3">
                    {membersQuery.data?.members.map((member) => (
                      <View
                        key={member.id}
                        className="flex-row items-center justify-between"
                      >
                        <Text className="text-foreground text-sm">
                          {[member.user.firstName, member.user.lastName]
                            .filter(Boolean)
                            .join(" ")}
                        </Text>
                        <Badge variant="outline">
                          {member.role === "ADMIN" ? "Admin" : "Member"}
                        </Badge>
                      </View>
                    ))}
                  </View>
                </CardContent>
              </Card>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
