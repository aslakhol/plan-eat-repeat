import { useSyncExternalStore } from "react";

const STORAGE_KEY = "plan-eat-repeat:shopping-category-headings";
const CHANGE_EVENT = "shopping-category-headings-change";
let enabled = true;
let storageAvailable = true;

function getSnapshot() {
  if (!storageAvailable) return enabled;
  try {
    enabled = window.localStorage.getItem(STORAGE_KEY) !== "false";
  } catch {
    // Keep the in-memory preference when browser storage is unavailable.
  }
  return enabled;
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function setEnabled(value: boolean) {
  enabled = value;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    storageAvailable = false;
    // The toggle still works for this session.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useShoppingCategoryHeadings() {
  const enabled = useSyncExternalStore(subscribe, getSnapshot, () => true);
  return { enabled, setEnabled };
}
