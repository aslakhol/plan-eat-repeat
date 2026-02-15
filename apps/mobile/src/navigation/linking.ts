import type { LinkingOptions } from "@react-navigation/native";
import * as ExpoLinking from "expo-linking";
import type { AppTabsParamList } from "./AppTabs";

const expoPrefix = ExpoLinking.createURL("/");

export const linking: LinkingOptions<AppTabsParamList> = {
  prefixes: [expoPrefix, "planeatrepeat://"],
  config: {
    screens: {
      Plan: "plan",
      Dinners: "dinners",
    },
  },
};
