import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Calendar, UtensilsCrossed } from "lucide-react-native";
import { PlanScreen } from "../screens/PlanScreen";
import { DinnersScreen } from "../screens/DinnersScreen";
import { colors } from "../theme/colors";

const Tab = createBottomTabNavigator();

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
    </Tab.Navigator>
  );
}
