import { Pressable, Text, type PressableProps, View } from "react-native";
import { cn } from "../../utils/cn";

type Variant = "default" | "outline" | "secondary" | "destructive" | "ghost";
type Size = "sm" | "md" | "lg";

type ButtonProps = PressableProps & {
  variant?: Variant;
  size?: Size;
  className?: string;
  textClassName?: string;
};

const variantClasses: Record<Variant, string> = {
  default: "bg-primary",
  outline: "border border-border bg-background",
  secondary: "bg-secondary",
  destructive: "bg-destructive",
  ghost: "bg-transparent",
};

const textVariantClasses: Record<Variant, string> = {
  default: "text-primary-foreground",
  outline: "text-foreground",
  secondary: "text-secondary-foreground",
  destructive: "text-destructive-foreground",
  ghost: "text-foreground",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-2",
  md: "px-4 py-3",
  lg: "px-5 py-4",
};

export function Button({
  variant = "default",
  size = "md",
  className,
  textClassName,
  children,
  ...props
}: ButtonProps) {
  const isText = typeof children === "string" || typeof children === "number";

  return (
    <Pressable
      className={cn(
        "flex-row items-center justify-center rounded-lg",
        variantClasses[variant],
        sizeClasses[size],
        props.disabled && "opacity-60",
        className,
      )}
      {...props}
    >
      {isText ? (
        <Text
          className={cn(
            "font-sans text-sm font-medium",
            textVariantClasses[variant],
            textClassName,
          )}
        >
          {children}
        </Text>
      ) : (
        <View className="flex-row items-center gap-2">{children}</View>
      )}
    </Pressable>
  );
}
