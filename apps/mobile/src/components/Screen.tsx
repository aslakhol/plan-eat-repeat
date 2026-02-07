import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { cn } from "../utils/cn";

type ScreenProps = {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  withPadding?: boolean;
};

export function Screen({
  children,
  className,
  contentClassName,
  withPadding = true,
}: ScreenProps) {
  return (
    <SafeAreaView className={cn("flex-1 bg-background", className)}>
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
