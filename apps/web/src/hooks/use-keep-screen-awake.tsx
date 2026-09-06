import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const STORAGE_KEY = "plan-eat-repeat:keep-screen-awake";

type KeepScreenAwakePreference = {
  enabled: boolean;
  isReady: boolean;
  setEnabled: (enabled: boolean) => void;
};

const KeepScreenAwakeContext = createContext<
  KeepScreenAwakePreference | undefined
>(undefined);

const storedPreference = () => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
};

export const KeepScreenAwakeProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [enabled, setEnabledState] = useState(true);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setEnabledState(storedPreference());
    setIsReady(true);

    const syncPreference = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY)
        setEnabledState(event.newValue !== "false");
    };

    window.addEventListener("storage", syncPreference);
    return () => window.removeEventListener("storage", syncPreference);
  }, []);

  const setEnabled = useCallback((nextEnabled: boolean) => {
    setEnabledState(nextEnabled);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(nextEnabled));
    } catch {
      // Browser storage is an enhancement; the in-memory preference still works.
    }
  }, []);

  return (
    <KeepScreenAwakeContext.Provider value={{ enabled, isReady, setEnabled }}>
      {children}
    </KeepScreenAwakeContext.Provider>
  );
};

export const useKeepScreenAwakePreference = () => {
  const preference = useContext(KeepScreenAwakeContext);
  if (!preference) {
    throw new Error(
      "useKeepScreenAwakePreference must be used within KeepScreenAwakeProvider",
    );
  }
  return preference;
};

export const useDinnerWakeLock = (isOpen: boolean) => {
  const { enabled, isReady } = useKeepScreenAwakePreference();
  useEffect(() => {
    if (!isReady || !enabled || !isOpen || !("wakeLock" in navigator)) return;

    let disposed = false;
    let sentinel: WakeLockSentinel | null = null;
    let requestInFlight = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let retryDelay = 1_000;

    const shouldLock = () =>
      !disposed && document.visibilityState === "visible";

    const cancelRetry = () => {
      clearTimeout(retryTimer);
      retryTimer = undefined;
    };

    const releaseLock = () => {
      const previous = sentinel;
      sentinel = null;
      if (previous?.released === false) {
        void previous.release().catch(() => undefined);
      }
    };

    const scheduleRetry = () => {
      if (!shouldLock() || retryTimer !== undefined) return;
      // Browsers can deny or revoke a lock temporarily. Back off while denied,
      // but keep trying while the recipe is visible without requiring a tap.
      retryTimer = setTimeout(() => {
        retryTimer = undefined;
        void requestLock();
      }, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 30_000);
    };

    const requestLock = async () => {
      if (!shouldLock() || requestInFlight || sentinel?.released === false) {
        return;
      }

      requestInFlight = true;
      try {
        const acquired = await navigator.wakeLock.request("screen");
        if (!shouldLock()) {
          await acquired.release();
          return;
        }
        // A lock can already have been released before the request settles.
        if (acquired.released) return;

        sentinel = acquired;
        retryDelay = 1_000;
        acquired.addEventListener(
          "release",
          () => {
            if (sentinel !== acquired) return;
            sentinel = null;
            scheduleRetry();
          },
          { once: true },
        );
      } catch {
        // Unsupported, denied, or interrupted wake locks must not block Dinner viewing.
      } finally {
        requestInFlight = false;
        // Also covers returning to the page before an interrupted request settles.
        if (sentinel?.released !== false) scheduleRetry();
      }
    };

    const applyDesiredState = () => {
      cancelRetry();
      retryDelay = 1_000;
      if (shouldLock()) void requestLock();
      else releaseLock();
    };

    applyDesiredState();
    document.addEventListener("visibilitychange", applyDesiredState);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", applyDesiredState);
      cancelRetry();
      releaseLock();
    };
  }, [enabled, isOpen, isReady]);
};
