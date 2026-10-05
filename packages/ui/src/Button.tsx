
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  type ViewStyle,
  type TextStyle,
  type PressableProps,
} from "react-native";

export interface ButtonProps extends Omit<PressableProps, "style"> {
  title: string;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  title,
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  disabled,
  style,
  textStyle,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        styles[`size_${size}`],
        fullWidth && styles.fullWidth,
        pressed && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "outline" || variant === "ghost" ? "#6366f1" : "#ffffff"}
        />
      ) : (
        <Text
          style={[
            styles.text,
            styles[`text_${variant}`],
            styles[`text_${size}`],
            textStyle,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    flexDirection: "row",
    gap: 8,
  },
  fullWidth: {
    width: "100%",
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.5,
  },

  // Variants
  primary: {
    backgroundColor: "#6366f1",
  },
  secondary: {
    backgroundColor: "#1e1b4b",
  },
  outline: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: "#6366f1",
  },
  ghost: {
    backgroundColor: "transparent",
  },
  danger: {
    backgroundColor: "#ef4444",
  },

  // Sizes
  size_sm: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  size_md: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  size_lg: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
  },

  // Text
  text: {
    fontWeight: "600",
  },
  text_primary: { color: "#ffffff" },
  text_secondary: { color: "#ffffff" },
  text_outline: { color: "#6366f1" },
  text_ghost: { color: "#6366f1" },
  text_danger: { color: "#ffffff" },
  text_sm: { fontSize: 13 },
  text_md: { fontSize: 15 },
  text_lg: { fontSize: 17 },
});
