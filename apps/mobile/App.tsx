import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import { TRPCProvider } from "./src/providers/TRPCProvider";
import { api } from "./src/utils/api";

function HomeScreen() {
  // Test query - will fail without auth but proves tRPC is working
  const { data, isLoading, error } = api.dinner.dinners.useQuery(undefined, {
    retry: false,
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>PlanEatRepeat</Text>
      <Text style={styles.subtitle}>Mobile App</Text>
      <View style={styles.status}>
        {isLoading && <Text>Loading...</Text>}
        {error && (
          <Text style={styles.error}>
            API Error: {error.message}
            {"\n"}(This is expected without auth)
          </Text>
        )}
        {data && <Text style={styles.success}>Connected! {data.dinners.length} dinners</Text>}
      </View>
      <StatusBar style="auto" />
    </View>
  );
}

export default function App() {
  return (
    <TRPCProvider>
      <HomeScreen />
    </TRPCProvider>
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
