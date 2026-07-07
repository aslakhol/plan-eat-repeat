import * as React from "react";
import { Image, ScrollView, Text, View } from "react-native";
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
import { Textarea } from "../components/ui/Textarea";

export function SettingsScreen() {
  const { signOut } = useClerk();
  const { user } = useUser();
  const [isSigningOut, setIsSigningOut] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [importInstructions, setImportInstructions] = React.useState("");

  const householdQuery = api.household.household.useQuery();
  const household = householdQuery.data?.household;
  const membersQuery = api.household.members.useQuery(
    { householdId: household?.id ?? "" },
    { enabled: !!household },
  );
  const utils = api.useUtils();
  const updateHouseholdMutation = api.household.updateHousehold.useMutation({
    onSuccess: async () => {
      await utils.household.household.invalidate();
    },
    onError: (mutationError) => {
      setError(mutationError.message);
    },
  });

  React.useEffect(() => {
    setImportInstructions(household?.importInstructions ?? "");
  }, [household?.importInstructions]);

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
      <ScrollView contentContainerClassName="gap-4 pb-8">
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
                  {[user?.firstName, user?.lastName].filter(Boolean).join(" ")}
                </Text>
                <Text className="text-muted-foreground text-sm">
                  {user?.primaryEmailAddress?.emailAddress}
                </Text>
              </View>
            </View>
            <Button
              variant="outline"
              onPress={() => {
                void onSignOut();
              }}
              disabled={isSigningOut}
              className="justify-center"
            >
              <LogOut size={16} color={colors.foreground} />
              <Text className="text-foreground font-sans text-sm font-medium">
                {isSigningOut ? "Signing out..." : "Sign Out"}
              </Text>
            </Button>
            {error && <Text className="text-destructive text-sm">{error}</Text>}
          </CardContent>
        </Card>

        {household && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Recipe imports</CardTitle>
              </CardHeader>
              <CardContent className="gap-3">
                <Text className="text-muted-foreground text-sm">
                  Set language, tone, or detail preferences for every imported
                  recipe.
                </Text>
                <Textarea
                  value={importInstructions}
                  onChangeText={setImportInstructions}
                  maxLength={1000}
                  placeholder="Keep steps short and explain techniques for beginners"
                />
                <Button
                  disabled={updateHouseholdMutation.isPending}
                  onPress={() =>
                    updateHouseholdMutation.mutate({
                      name: household.name,
                      slug: household.slug,
                      importInstructions: importInstructions.trim() || null,
                    })
                  }
                >
                  <Text className="text-primary-foreground font-semibold">
                    {updateHouseholdMutation.isPending
                      ? "Saving…"
                      : "Save import instructions"}
                  </Text>
                </Button>
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
    </Screen>
  );
}
