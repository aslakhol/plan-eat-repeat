import { useState } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { useAuth } from "@clerk/clerk-expo";
import superjson from "superjson";
import { api } from "../utils/api";

// Configure the API URL based on the platform
const getBaseUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) {
    return envUrl;
  }

  // Expo Go on a physical device: infer dev machine host from metro host URI.
  const hostUri =
    Constants.expoConfig?.hostUri ??
    Constants.manifest2?.extra?.expoGo?.debuggerHost ??
    null;
  const host = hostUri?.split(":")[0];
  if (host) {
    return `http://${host}:3000`;
  }

  // iOS Simulator can use localhost
  if (Platform.OS === "ios") {
    return "http://localhost:3000";
  }
  // Android Emulator uses 10.0.2.2 for host's localhost
  return "http://10.0.2.2:3000";
};

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  const baseUrl = getBaseUrl();
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    api.createClient({
      links: [
        httpBatchLink({
          url: `${baseUrl}/api/trpc`,
          transformer: superjson,
          async headers() {
            try {
              const token = await getToken();
              return {
                Authorization: token ? `Bearer ${token}` : "",
              };
            } catch {
              return {};
            }
          },
        }),
      ],
    })
  );

  return (
    <api.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </api.Provider>
  );
}
