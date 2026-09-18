import { useAuth, useUser } from "@clerk/nextjs";
import { getQueryKey } from "@trpc/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/router";
import {
  createContext,
  useContext,
  memo,
  useLayoutEffect,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "~/utils/api";
import { useAddShoppingItem } from "./use-add-shopping-item";
import { useMoveShoppingItem } from "./use-move-shopping-item";

type ShoppingState = ReturnType<typeof useShoppingState>;
type ShoppingSnapshot = { identity: string; value: ShoppingState };
const ShoppingContext = createContext<ShoppingState | null>(null);

// Only the shopping owner resets on identity changes. Keep unrelated page state
// mounted, including authentication continuations on Published Dinners.
export function ShoppingProvider({ children }: { children: ReactNode }) {
  const { userId, sessionId, sessionClaims } = useAuth();
  const { user } = useUser();
  const identity = JSON.stringify([
    userId,
    sessionId,
    sessionClaims?.metadata?.householdId,
    user?.publicMetadata.householdId,
  ]);
  const [snapshot, setSnapshot] = useState<ShoppingSnapshot | null>(null);
  return (
    <ShoppingContext.Provider
      value={snapshot?.identity === identity ? snapshot.value : null}
    >
      <ShoppingSession
        key={identity}
        identity={identity}
        publish={setSnapshot}
      />
      {children}
    </ShoppingContext.Provider>
  );
}

// Publishing shopping state must not make its owner render again.
const ShoppingSession = memo(function ShoppingSession({
  identity,
  publish,
}: {
  identity: string;
  publish: (snapshot: ShoppingSnapshot) => void;
}) {
  const client = useQueryClient();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    const reset = async () => {
      const filters = [api.shoppingList, api.oda, api.dinner, api.plan].map(
        (router) => ({
          queryKey: getQueryKey(router),
        }),
      );
      await Promise.all(filters.map((filter) => client.cancelQueries(filter)));
      if (!active) return;
      // Clear old data while restarting any readers that stayed mounted.
      // Their refreshes must not delay the new shopping session.
      for (const filter of filters) void client.resetQueries(filter);
      setReady(true);
    };
    void reset();
    return () => {
      active = false;
    };
  }, [client]);
  return ready ? (
    <ShoppingStatePublisher identity={identity} publish={publish} />
  ) : null;
});

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

function ShoppingStatePublisher({
  identity,
  publish,
}: {
  identity: string;
  publish: (snapshot: ShoppingSnapshot) => void;
}) {
  const value = useShoppingState();
  useLayoutEffect(() => {
    publish({ identity, value });
  });
  return null;
}

export function ShoppingReady({ children }: { children: ReactNode }) {
  return useContext(ShoppingContext) ? children : null;
}

export function useShopping() {
  const value = useContext(ShoppingContext);
  if (!value) throw new Error("ShoppingProvider is missing");
  return value;
}
