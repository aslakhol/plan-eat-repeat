import "./global.css";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator } from "react-native";
import { ClerkLoaded, ClerkLoading, SignedIn, SignedOut } from "@clerk/clerk-expo";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { Quicksand_400Regular } from "@expo-google-fonts/quicksand";
import { YoungSerif_400Regular } from "@expo-google-fonts/young-serif";
import { ClerkProvider } from "./src/providers/ClerkProvider";
import { TRPCProvider } from "./src/providers/TRPCProvider";
import { AppTabs } from "./src/navigation/AppTabs";
import { AuthScreen } from "./src/screens/AuthScreen";
import { colors } from "./src/theme/colors";

export default function App() {
  const [fontsLoaded] = useFonts({
    Quicksand_400Regular,
    YoungSerif_400Regular,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ClerkProvider>
      <TRPCProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <BottomSheetModalProvider>
              <NavigationContainer>
                <ClerkLoaded>
                  <SignedIn>
                    <AppTabs />
                  </SignedIn>
                  <SignedOut>
                    <AuthScreen />
                  </SignedOut>
                </ClerkLoaded>
                <ClerkLoading>
                  <View
                    style={{
                      flex: 1,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <ActivityIndicator color={colors.primary} />
                  </View>
                </ClerkLoading>
              </NavigationContainer>
            </BottomSheetModalProvider>
          </SafeAreaProvider>
        </GestureHandlerRootView>
        <StatusBar style="auto" />
      </TRPCProvider>
    </ClerkProvider>
  );
}
