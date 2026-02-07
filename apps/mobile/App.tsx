import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View, Button } from "react-native";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { ClerkProvider } from "./src/providers/ClerkProvider";
import { TRPCProvider } from "./src/providers/TRPCProvider";
import { api } from "./src/utils/api";
import { SignInWithOAuth } from "./src/components/SignInWithOAuth";

function HomeScreen() {
  const { signOut, isSignedIn, isLoaded, getToken } = useAuth();
  const { user } = useUser();

  // Fetch household first - this syncs householdId to Clerk metadata if missing
  const {
    data: householdData,
    isLoading: householdLoading,
    refetch: refetchHousehold,
  } = api.household.household.useQuery(undefined, {
    enabled: isSignedIn,
    retry: false,
  });

  // Fetch dinners after household is loaded
  const { data, isLoading, error, refetch: refetchDinners } = api.dinner.dinners.useQuery(undefined, {
    enabled: isSignedIn && !!householdData?.household,
    retry: false,
  });

  // If user has a household but 0 dinners returned, session may need refresh
  const needsSessionRefresh = householdData?.household && data?.dinners.length === 0;

  const handleRefreshSession = async () => {
    // Force token refresh and refetch data
    await getToken({ skipCache: true });
    await refetchHousehold();
    await refetchDinners();
  };

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
          <SignInWithOAuth />
        </View>
      )}

      {!isLoaded && (
        <View style={styles.authSection}>
          <Text style={styles.authText}>Loading auth...</Text>
        </View>
      )}

      <View style={styles.status}>
        {(householdLoading || isLoading) && <Text>Loading...</Text>}
        {error && (
          <Text style={styles.error}>
            API Error: {error.message}
          </Text>
        )}
        {householdData && !householdData.household && (
          <Text style={styles.warning}>
            No household found. Join or create one on the web app.
          </Text>
        )}
        {householdData?.household && (
          <View style={styles.householdInfo}>
            <Text style={styles.householdName}>
              Household: {householdData.household.name}
            </Text>
            {data && (
              <Text style={styles.success}>
                {data.dinners.length} dinners found
              </Text>
            )}
            {needsSessionRefresh && (
              <View style={styles.refreshSection}>
                <Text style={styles.warning}>
                  Session needs refresh to see dinners
                </Text>
                <Button title="Refresh Session" onPress={handleRefreshSession} />
              </View>
            )}
          </View>
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
  warning: {
    color: "#a50",
    textAlign: "center",
  },
  householdInfo: {
    alignItems: "center",
    gap: 8,
  },
  householdName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  refreshSection: {
    marginTop: 8,
    alignItems: "center",
    gap: 8,
  },
});
