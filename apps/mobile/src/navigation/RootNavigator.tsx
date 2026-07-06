import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { NavigatorScreenParams } from "@react-navigation/native";
import { AppTabs, type AppTabsParamList } from "./AppTabs";
import { DinnerDetailScreen } from "../screens/DinnerDetailScreen";
import { NewDinnerScreen } from "../screens/NewDinnerScreen";
import { colors } from "../theme/colors";

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<AppTabsParamList> | undefined;
  DinnerDetail: { dinnerId: number; edit?: boolean };
  NewDinner: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        contentStyle: { backgroundColor: colors.background },
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTintColor: colors.foreground,
        headerTitleStyle: {
          fontFamily: "YoungSerif_400Regular",
        },
      }}
    >
      <Stack.Screen
        name="Tabs"
        component={AppTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="NewDinner"
        component={NewDinnerScreen}
        options={{ title: "New dinner" }}
      />
      <Stack.Screen
        name="DinnerDetail"
        component={DinnerDetailScreen}
        options={{ title: "Dinner" }}
      />
    </Stack.Navigator>
  );
}
