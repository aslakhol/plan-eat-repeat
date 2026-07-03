import { useState } from "react";
import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { useAuth } from "@clerk/clerk-expo";
import superjson from "superjson";
import { api } from "../utils/api";
import { getBaseUrl } from "../utils/baseUrl";

const householdQueryKey = [["household", "household"]];

const isForbiddenError = (error: unknown) =>
  error instanceof TRPCClientError &&
  (error.data as { code?: string } | undefined)?.code === "FORBIDDEN";

const isHouseholdQueryKey = (queryKey: readonly unknown[]) =>
  JSON.stringify(queryKey[0]) === JSON.stringify(householdQueryKey[0]);

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  const baseUrl = getBaseUrl();
  const [queryClient] = useState(() => {
    // If the user loses their household (e.g. removed by an admin), household
    // queries start failing with FORBIDDEN. Refetch the household so the
    // gate in App.tsx lands them back on onboarding instead of broken tabs.
    const client: QueryClient = new QueryClient({
      queryCache: new QueryCache({
        onError: (error, query) => {
          if (isForbiddenError(error) && !isHouseholdQueryKey(query.queryKey)) {
            void client.invalidateQueries({ queryKey: householdQueryKey });
          }
        },
      }),
    });
    return client;
  });
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
