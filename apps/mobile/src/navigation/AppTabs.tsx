import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Calendar, Settings, UtensilsCrossed } from "lucide-react-native";
import { PlanScreen } from "../screens/PlanScreen";
import { DinnersScreen } from "../screens/DinnersScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { colors } from "../theme/colors";

export type AppTabsParamList = {
  Plan: undefined;
  Dinners: { openNew?: boolean; dinnerId?: number } | undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<AppTabsParamList>();

export function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "500",
        },
      }}
    >
      <Tab.Screen
        name="Plan"
        component={PlanScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Calendar color={color} size={size ?? 20} />
          ),
        }}
      />
      <Tab.Screen
        name="Dinners"
        component={DinnersScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <UtensilsCrossed color={color} size={size ?? 20} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Settings color={color} size={size ?? 20} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
