import * as React from "react";
import { View, Text, Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useSSO } from "@clerk/clerk-expo";
import { Screen } from "../components/Screen";
import { Button } from "../components/ui/Button";
import { colors } from "../theme/colors";

WebBrowser.maybeCompleteAuthSession();

export function AuthScreen() {
  const { startSSOFlow } = useSSO();
  const [error, setError] = React.useState<string | null>(null);
  const [loadingProvider, setLoadingProvider] = React.useState<string | null>(
    null,
  );

  const startProvider = async (strategy: "oauth_google" | "oauth_apple") => {
    try {
      setError(null);
      setLoadingProvider(strategy);
      const { createdSessionId, setActive } = await startSSOFlow({ strategy });

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign in failed";
      setError(message);
    } finally {
      setLoadingProvider(null);
    }
  };

  return (
    <Screen contentClassName="items-center justify-center gap-8" withPadding>
      <View className="items-center gap-4 px-6">
        <Text className="font-serif text-4xl font-bold text-foreground text-center">
          Plan. Eat. Repeat.
        </Text>
        <Text className="text-center text-base text-muted-foreground">
          Effortlessly organize meals and plan your week with your household.
        </Text>
      </View>

      <View className="w-full max-w-md gap-3 px-6">
        <Button
          onPress={() => startProvider("oauth_google")}
          disabled={!!loadingProvider}
          className="w-full"
        >
          {loadingProvider === "oauth_google"
            ? "Signing in..."
            : "Continue with Google"}
        </Button>

        {Platform.OS === "ios" && (
          <Button
            variant="outline"
            onPress={() => startProvider("oauth_apple")}
            disabled={!!loadingProvider}
            className="w-full"
          >
            {loadingProvider === "oauth_apple"
              ? "Signing in..."
              : "Continue with Apple"}
          </Button>
        )}

        <Text className="text-center text-xs text-muted-foreground">
          Email and password sign-in will be added to match web parity.
        </Text>

        {error && (
          <Text className="text-center text-xs text-destructive">{error}</Text>
        )}
      </View>

      <Text className="text-xs text-muted-foreground">
        By continuing you agree to the PlanEatRepeat terms.
      </Text>
    </Screen>
  );
}
