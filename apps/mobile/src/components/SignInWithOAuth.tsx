import { useCallback, useState } from "react";
import { Button, View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useOAuth } from "@clerk/clerk-expo";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";

// Required for OAuth redirect to work properly
WebBrowser.maybeCompleteAuthSession();

export function SignInWithOAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { startOAuthFlow } = useOAuth({ strategy: "oauth_google" });

  const onPress = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { createdSessionId, setActive } = await startOAuthFlow({
        redirectUrl: Linking.createURL("/oauth-callback"),
      });

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
      }
    } catch (err) {
      console.error("OAuth error:", err);
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setIsLoading(false);
    }
  }, [startOAuthFlow]);

  return (
    <View style={styles.container}>
      <Button
        title={isLoading ? "Signing in..." : "Sign in with Google"}
        onPress={onPress}
        disabled={isLoading}
      />
      {isLoading && <ActivityIndicator style={styles.spinner} />}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 8,
  },
  spinner: {
    marginTop: 8,
  },
  error: {
    color: "#c00",
    fontSize: 12,
    marginTop: 8,
    textAlign: "center",
  },
});
