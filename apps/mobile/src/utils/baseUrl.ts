import { Platform } from "react-native";
import Constants from "expo-constants";

export const getBaseUrl = () => {
  const parityBypassEnabled = process.env.EXPO_PUBLIC_PARITY_BYPASS_AUTH === "true";
  const parityApiUrl = process.env.EXPO_PUBLIC_PARITY_API_URL;
  const parityApiPort = process.env.EXPO_PUBLIC_PARITY_API_PORT ?? "3100";
  if (parityBypassEnabled) {
    if (parityApiUrl) {
      return parityApiUrl;
    }
    // Parity scripts set up adb reverse, so localhost resolves to host API.
    return `http://127.0.0.1:${parityApiPort}`;
  }

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
