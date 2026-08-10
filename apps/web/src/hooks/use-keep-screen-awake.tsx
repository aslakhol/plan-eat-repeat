import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
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
  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  const requestInFlightRef = useRef(false);
  const shouldLockRef = useRef(false);

  const requestLock = useCallback(async () => {
    if (
      !shouldLockRef.current ||
      requestInFlightRef.current ||
      sentinelRef.current?.released === false ||
      typeof navigator === "undefined" ||
      !("wakeLock" in navigator)
    ) {
      return;
    }

    requestInFlightRef.current = true;
    try {
      const sentinel = await navigator.wakeLock.request("screen");

      if (!shouldLockRef.current || document.visibilityState !== "visible") {
        await sentinel.release();
        return;
      }

      sentinelRef.current = sentinel;
      sentinel.addEventListener(
        "release",
        () => {
          if (sentinelRef.current !== sentinel) return;
          sentinelRef.current = null;
        },
        { once: true },
      );
    } catch {
      // Unsupported, denied, or interrupted wake locks must not block Dinner viewing.
    } finally {
      requestInFlightRef.current = false;
    }
  }, []);

  const releaseLock = useCallback(() => {
    const sentinel = sentinelRef.current;
    sentinelRef.current = null;
    if (sentinel?.released === false) {
      void sentinel.release().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const applyDesiredState = () => {
      shouldLockRef.current =
        isReady && enabled && isOpen && document.visibilityState === "visible";

      if (shouldLockRef.current) void requestLock();
      else releaseLock();
    };

    applyDesiredState();
    document.addEventListener("visibilitychange", applyDesiredState);
    return () => {
      document.removeEventListener("visibilitychange", applyDesiredState);
      shouldLockRef.current = false;
      releaseLock();
    };
  }, [enabled, isOpen, isReady, releaseLock, requestLock]);
};
