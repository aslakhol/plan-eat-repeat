import "./global.css";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator, Text } from "react-native";
import {
  ClerkLoaded,
  ClerkLoading,
  SignedIn,
  SignedOut,
} from "@clerk/clerk-expo";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { Quicksand_400Regular } from "@expo-google-fonts/quicksand";
import { YoungSerif_400Regular } from "@expo-google-fonts/young-serif";
import { ClerkProvider } from "./src/providers/ClerkProvider";
import { TRPCProvider } from "./src/providers/TRPCProvider";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { OnboardingScreen } from "./src/screens/OnboardingScreen";
import { linking } from "./src/navigation/linking";
import { AuthScreen } from "./src/screens/AuthScreen";
import { Button } from "./src/components/ui/Button";
import { colors } from "./src/theme/colors";
import { api } from "./src/utils/api";

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
              <NavigationContainer linking={linking}>
                <ClerkLoaded>
                  <SignedIn>
                    <HouseholdGate />
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

function LoadingScreen() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

function HouseholdGate() {
  const householdQuery = api.household.household.useQuery(undefined, {
    retry: false,
  });

  if (householdQuery.isPending) {
    return <LoadingScreen />;
  }

  if (householdQuery.isError && !householdQuery.data) {
    return (
      <View className="bg-background flex-1 items-center justify-center gap-4 px-6">
        <Text className="text-destructive text-center text-base">
          We couldn&apos;t load your household.
        </Text>
        <Button onPress={() => void householdQuery.refetch()}>Try again</Button>
      </View>
    );
  }

  if (!householdQuery.data?.household) {
    return <OnboardingScreen />;
  }

  return <RootNavigator />;
}
