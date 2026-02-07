import { ClerkProvider as BaseClerkProvider } from "@clerk/clerk-expo";
import * as SecureStore from "expo-secure-store";

// Secure token cache for Clerk using expo-secure-store
const tokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (err) {
      console.error("SecureStore getToken error:", err);
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (err) {
      console.error("SecureStore saveToken error:", err);
    }
  },
  async clearToken(key: string) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (err) {
      console.error("SecureStore clearToken error:", err);
    }
  },
};

// Get your publishable key from Clerk dashboard
const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

export function ClerkProvider({ children }: { children: React.ReactNode }) {
  // If no key is set, render children without Clerk (for testing)
  if (!CLERK_PUBLISHABLE_KEY) {
    console.warn(
      "Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY. Auth features disabled."
    );
    return <>{children}</>;
  }

  return (
    <BaseClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
      {children}
    </BaseClerkProvider>
  );
}
