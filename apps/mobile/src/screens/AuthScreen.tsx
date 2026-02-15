import * as React from "react";
import { View, Text, Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useSSO, useSignIn } from "@clerk/clerk-expo";
import { Screen } from "../components/Screen";
import { Button } from "../components/ui/Button";
import { getBaseUrl } from "../utils/baseUrl";

WebBrowser.maybeCompleteAuthSession();

export function AuthScreen() {
  const { startSSOFlow } = useSSO();
  const { isLoaded, signIn, setActive } = useSignIn();
  const [error, setError] = React.useState<string | null>(null);
  const [loadingProvider, setLoadingProvider] = React.useState<string | null>(
    null,
  );
  const [isBypassing, setIsBypassing] = React.useState(false);

  const baseUrl = React.useMemo(() => getBaseUrl(), []);
  const showDevBypass = React.useMemo(() => {
    if (!__DEV__) {
      return false;
    }

    try {
      const hostname = new URL(baseUrl).hostname;
      return (
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "::1" ||
        hostname.startsWith("192.168.") ||
        hostname.startsWith("10.") ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
      );
    } catch {
      return false;
    }
  }, [baseUrl]);

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

  const signInWithDevBypass = async () => {
    try {
      setError(null);
      setIsBypassing(true);

      const response = await fetch(`${baseUrl}/api/dev/auth-bypass`, {
        method: "POST",
      });
      const payload = (await response.json()) as { ticket?: string; error?: string };
      if (!response.ok || !payload.ticket) {
        throw new Error(payload.error ?? "Failed to start dev bypass sign-in");
      }

      if (!isLoaded || !signIn || !setActive) {
        throw new Error("Clerk is not ready yet");
      }

      const attempt = await signIn.create({
        strategy: "ticket",
        ticket: payload.ticket,
      });
      if (!attempt.createdSessionId) {
        throw new Error("Dev bypass sign-in did not create a session");
      }

      await setActive({ session: attempt.createdSessionId });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Dev bypass sign-in failed";
      setError(message);
    } finally {
      setIsBypassing(false);
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
        {showDevBypass && (
          <Button
            variant="outline"
            onPress={() => {
              void signInWithDevBypass();
            }}
            disabled={!!loadingProvider || isBypassing}
            className="w-full"
          >
            local login
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
