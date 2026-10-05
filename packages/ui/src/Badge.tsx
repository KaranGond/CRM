
import { View, Text, StyleSheet, type ViewStyle } from "react-native";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info";

export interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: "sm" | "md";
  style?: ViewStyle;
}

const VARIANT_COLORS: Record<
  BadgeVariant,
  { bg: string; text: string }
> = {
  default: { bg: "rgba(99, 102, 241, 0.15)", text: "#a5b4fc" },
  success: { bg: "rgba(34, 197, 94, 0.15)", text: "#4ade80" },
  warning: { bg: "rgba(234, 179, 8, 0.15)", text: "#facc15" },
  danger: { bg: "rgba(239, 68, 68, 0.15)", text: "#f87171" },
  info: { bg: "rgba(56, 189, 248, 0.15)", text: "#38bdf8" },
};

export function Badge({
  label,
  variant = "default",
  size = "sm",
  style,
}: BadgeProps) {
  const colors = VARIANT_COLORS[variant];

  return (
    <View
      style={[
        styles.base,
        size === "md" && styles.sizeMd,
        { backgroundColor: colors.bg },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          size === "md" && styles.textMd,
          { color: colors.text },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: "flex-start",
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  sizeMd: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  text: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  textMd: {
    fontSize: 13,
  },
});
