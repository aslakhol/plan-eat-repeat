import { View } from "react-native";
import {
  SafeAreaView,
  type Edge,
} from "react-native-safe-area-context";
import { cn } from "../utils/cn";

type ScreenProps = {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  withPadding?: boolean;
  edges?: Edge[];
};

export function Screen({
  children,
  className,
  contentClassName,
  withPadding = true,
  edges = ["top", "right", "bottom", "left"],
}: ScreenProps) {
  return (
    <SafeAreaView edges={edges} className={cn("flex-1 bg-background", className)}>
      <View
        className={cn(
          "flex-1",
          withPadding ? "px-4 pb-4 pt-3" : undefined,
          contentClassName,
        )}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}
