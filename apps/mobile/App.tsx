import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View, Button } from "react-native";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { ClerkProvider } from "./src/providers/ClerkProvider";
import { TRPCProvider } from "./src/providers/TRPCProvider";
import { api } from "./src/utils/api";

function HomeScreen() {
  const { signOut, isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const { data, isLoading, error } = api.dinner.dinners.useQuery(undefined, {
    retry: false,
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>PlanEatRepeat</Text>
      <Text style={styles.subtitle}>Mobile App</Text>

      {isLoaded && isSignedIn && (
        <View style={styles.userInfo}>
          <Text style={styles.welcome}>
            Welcome, {user?.firstName || user?.emailAddresses?.[0]?.emailAddress}!
          </Text>
          <Button title="Sign Out" onPress={() => signOut()} />
        </View>
      )}

      {isLoaded && !isSignedIn && (
        <View style={styles.authSection}>
          <Text style={styles.authText}>Sign in to access your dinners</Text>
          <Text style={styles.authNote}>(OAuth sign-in coming soon)</Text>
        </View>
      )}

      {!isLoaded && (
        <View style={styles.authSection}>
          <Text style={styles.authText}>Loading auth...</Text>
        </View>
      )}

      <View style={styles.status}>
        {isLoading && <Text>Loading dinners...</Text>}
        {error && (
          <Text style={styles.error}>
            API Error: {error.message}
          </Text>
        )}
        {data && (
          <Text style={styles.success}>
            Connected! {data.dinners.length} dinners found
          </Text>
        )}
      </View>
      <StatusBar style="auto" />
    </View>
  );
}

export default function App() {
  return (
    <ClerkProvider>
      <TRPCProvider>
        <HomeScreen />
      </TRPCProvider>
    </ClerkProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 24,
  },
  userInfo: {
    marginBottom: 24,
    alignItems: "center",
    gap: 12,
  },
  welcome: {
    fontSize: 16,
    color: "#333",
  },
  authSection: {
    marginBottom: 24,
    alignItems: "center",
    gap: 12,
  },
  authText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  authNote: {
    fontSize: 12,
    color: "#999",
    fontStyle: "italic",
  },
  status: {
    padding: 16,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    width: "100%",
  },
  error: {
    color: "#c00",
    textAlign: "center",
  },
  success: {
    color: "#0a0",
    textAlign: "center",
  },
});
