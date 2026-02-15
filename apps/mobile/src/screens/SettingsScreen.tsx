import * as React from "react";
import { Text, View } from "react-native";
import { useClerk } from "@clerk/clerk-expo";
import { LogOut } from "lucide-react-native";
import { Screen } from "../components/Screen";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { colors } from "../theme/colors";

export function SettingsScreen() {
  const { signOut } = useClerk();
  const [isSigningOut, setIsSigningOut] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

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
    <Screen>
      <View className="gap-4">
        <Text className="font-serif text-3xl font-bold text-foreground">
          Settings
        </Text>

        <Card>
          <CardHeader>
            <CardTitle>Temporary Mobile Settings</CardTitle>
          </CardHeader>
          <CardContent className="gap-3">
            <Text className="text-sm text-muted-foreground">
              TODO(TEMP): Replace this screen with full settings parity from web.
            </Text>
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
            {error && (
              <Text className="text-sm text-destructive">{error}</Text>
            )}
          </CardContent>
        </Card>
      </View>
    </Screen>
  );
}
