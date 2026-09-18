import { useAuth, useUser } from "@clerk/nextjs";
import { getQueryKey } from "@trpc/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/router";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "~/utils/api";
import { useAddShoppingItem } from "./use-add-shopping-item";
import { useMoveShoppingItem } from "./use-move-shopping-item";

const ShoppingContext = createContext<ReturnType<
  typeof useShoppingState
> | null>(null);

// This owner lives above page layouts, including pages with their own layout.
// A new identity must start with an empty shopping cache before mounting readers.
export function ShoppingProvider({ children }: { children: ReactNode }) {
  const { userId, sessionId, sessionClaims } = useAuth();
  const { user } = useUser();
  const identity = JSON.stringify([
    userId,
    sessionId,
    sessionClaims?.metadata?.householdId,
    user?.publicMetadata.householdId,
  ]);
  return <ShoppingSession key={identity}>{children}</ShoppingSession>;
}

function ShoppingSession({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const { isSignedIn } = useAuth();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    const reset = async () => {
      const filters = [api.shoppingList, api.oda].map((router) => ({
        queryKey: getQueryKey(router),
      }));
      await Promise.all(filters.map((filter) => client.cancelQueries(filter)));
      if (!active) return;
      for (const filter of filters) client.removeQueries(filter);
      setReady(true);
    };
    void reset();
    return () => {
      active = false;
    };
  }, [client]);
  return ready || !isSignedIn ? (
    <ShoppingStateProvider>{children}</ShoppingStateProvider>
  ) : null;
}

function useShoppingState() {
  const { isSignedIn } = useAuth();
  const { pathname } = useRouter();
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const isCurrent = () => active.current;
  const queryOptions = {
    enabled: !!isSignedIn && pathname === "/shopping-list",
    refetchInterval: 2000,
    refetchOnWindowFocus: "always" as const,
    refetchOnReconnect: "always" as const,
  };
  const list = api.shoppingList.list.useQuery(undefined, queryOptions);
  const recent = api.shoppingList.recent.useQuery(undefined, queryOptions);
  return {
    list,
    recent,
    ...useAddShoppingItem(isCurrent),
    ...useMoveShoppingItem(list.data ?? [], recent.data ?? [], isCurrent),
  };
}

function ShoppingStateProvider({ children }: { children: ReactNode }) {
  const value = useShoppingState();
  return (
    <ShoppingContext.Provider value={value}>
      {children}
    </ShoppingContext.Provider>
  );
}

export function useShopping() {
  const value = useContext(ShoppingContext);
  if (!value) throw new Error("ShoppingProvider is missing");
  return value;
}
