import { useState } from "react";
import { Platform } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { useAuth } from "@clerk/clerk-expo";
import superjson from "superjson";
import { api } from "../utils/api";

// Configure the API URL based on the platform
const getBaseUrl = () => {
  // iOS Simulator can use localhost
  if (Platform.OS === "ios") {
    return "http://localhost:3000";
  }
  // Android Emulator uses 10.0.2.2 for host's localhost
  // Physical Android device needs actual IP address
  // TODO: For production, use your actual API domain
  return "http://192.168.0.204:3000";
};

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    api.createClient({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
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
