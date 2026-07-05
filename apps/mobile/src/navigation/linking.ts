import type { LinkingOptions } from "@react-navigation/native";
import * as ExpoLinking from "expo-linking";
import type { RootStackParamList } from "./RootNavigator";

const expoPrefix = ExpoLinking.createURL("/");

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [expoPrefix, "planeatrepeat://"],
  config: {
    screens: {
      Tabs: {
        screens: {
          Plan: "plan",
          Dinners: "dinners",
          Settings: "settings",
        },
      },
      DinnerDetail: {
        path: "dinners/:dinnerId",
        parse: {
          dinnerId: Number,
        },
      },
    },
  },
};
