import * as React from "react";
import { Image, Text, View } from "react-native";
import { useClerk, useUser } from "@clerk/clerk-expo";
import { LogOut } from "lucide-react-native";
import { Screen } from "../components/Screen";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { api } from "../utils/api";
import { colors } from "../theme/colors";

export function SettingsScreen() {
  const { signOut } = useClerk();
  const { user } = useUser();
  const [isSigningOut, setIsSigningOut] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const householdQuery = api.household.household.useQuery();
  const household = householdQuery.data?.household;
  const membersQuery = api.household.members.useQuery(
    { householdId: household?.id ?? "" },
    { enabled: !!household },
  );

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
      <View className="gap-4">
        <Text className="font-serif text-3xl text-foreground">
          Settings
        </Text>

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
                <View className="h-12 w-12 items-center justify-center rounded-full bg-secondary">
                  <Text className="text-base font-semibold text-secondary-foreground">
                    {user?.firstName?.[0] ?? "?"}
                  </Text>
                </View>
              )}
              <View className="flex-1">
                <Text className="text-base font-medium text-foreground">
                  {[user?.firstName, user?.lastName].filter(Boolean).join(" ")}
                </Text>
                <Text className="text-sm text-muted-foreground">
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
              <Text className="font-sans text-sm font-medium text-foreground">
                {isSigningOut ? "Signing out..." : "Sign Out"}
              </Text>
            </Button>
            {error && <Text className="text-sm text-destructive">{error}</Text>}
          </CardContent>
        </Card>

        {household && (
          <Card>
            <CardHeader>
              <CardTitle>Household</CardTitle>
            </CardHeader>
            <CardContent className="gap-4">
              <Text className="text-base text-foreground">
                {household.name}
              </Text>
              <View className="gap-3">
                {membersQuery.data?.members.map((member) => (
                  <View
                    key={member.id}
                    className="flex-row items-center justify-between"
                  >
                    <Text className="text-sm text-foreground">
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
        )}
      </View>
    </Screen>
  );
}
