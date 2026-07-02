import { View, Text, type ViewProps, type TextProps } from "react-native";
import { cn } from "../../utils/cn";

export function Card({ className, ...props }: ViewProps & { className?: string }) {
  return (
    <View className={cn("rounded-lg border border-border bg-card", className)} {...props} />
  );
}

export function CardHeader({
  className,
  ...props
}: ViewProps & { className?: string }) {
  return <View className={cn("p-4 pb-2", className)} {...props} />;
}

export function CardContent({
  className,
  ...props
}: ViewProps & { className?: string }) {
  return <View className={cn("p-4 pt-2", className)} {...props} />;
}

export function CardTitle({
  className,
  ...props
}: TextProps & { className?: string }) {
  return <Text className={cn("font-serif text-lg text-foreground", className)} {...props} />;
}
