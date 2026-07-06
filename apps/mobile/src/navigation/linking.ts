import type { LinkingOptions } from "@react-navigation/native";
import * as ExpoLinking from "expo-linking";
import type { RootStackParamList } from "./RootNavigator";

const expoPrefix = ExpoLinking.createURL("/");

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [expoPrefix, "planeatrepeat://"],
  config: {
    // Keep the tabs beneath DinnerDetail when opened via deep link,
    // so back navigation returns to the app instead of exiting.
    initialRouteName: "Tabs",
    screens: {
      Tabs: {
        screens: {
          Plan: "plan",
          Dinners: "dinners",
          Settings: "settings",
        },
      },
      NewDinner: "dinners/new",
      DinnerDetail: {
        path: "dinners/:dinnerId",
        parse: {
          dinnerId: Number,
        },
      },
    },
  },
};
