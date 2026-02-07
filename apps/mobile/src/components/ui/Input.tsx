import { TextInput, type TextInputProps } from "react-native";
import { cn } from "../../utils/cn";
import { colors } from "../../theme/colors";

export function Input({ className, placeholderTextColor, ...props }: TextInputProps & { className?: string }) {
  return (
    <TextInput
      className={cn(
        "rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground",
        className,
      )}
      placeholderTextColor={placeholderTextColor ?? colors.mutedForeground}
      {...props}
    />
  );
}
