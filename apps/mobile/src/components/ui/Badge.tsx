import { Pressable, Text, View, type PressableProps } from "react-native";
import { cn } from "../../utils/cn";

type Variant = "secondary" | "outline";

type BadgeProps = PressableProps & {
  variant?: Variant;
  className?: string;
  textClassName?: string;
};

const variantClasses: Record<Variant, string> = {
  secondary: "bg-secondary",
  outline: "border border-border bg-background",
};

const textVariantClasses: Record<Variant, string> = {
  secondary: "text-secondary-foreground",
  outline: "text-foreground",
};

export function Badge({
  variant = "secondary",
  className,
  textClassName,
  children,
  ...props
}: BadgeProps) {
  const isText = typeof children === "string" || typeof children === "number";

  return (
    <Pressable
      className={cn(
        "flex-row items-center rounded-full border border-transparent px-2.5 py-0.5",
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {isText ? (
        <Text
          className={cn(
            "text-xs font-semibold",
            textVariantClasses[variant],
            textClassName,
          )}
        >
          {children}
        </Text>
      ) : (
        <View className="flex-row items-center gap-1">{children}</View>
      )}
    </Pressable>
  );
}
