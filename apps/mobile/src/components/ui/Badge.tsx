import { Pressable, Text, type PressableProps } from "react-native";
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
  return (
    <Pressable
      className={cn("flex-row items-center rounded-full px-2 py-1", variantClasses[variant], className)}
      {...props}
    >
      <Text className={cn("text-xs font-medium", textVariantClasses[variant], textClassName)}>
        {children}
      </Text>
    </Pressable>
  );
}
