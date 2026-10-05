import { type ReactNode } from "react";
import { View, Text, StyleSheet, type ViewStyle } from "react-native";

export interface CardProps {
  title?: string;
  subtitle?: string;
  children?: ReactNode;
  style?: ViewStyle;
  padded?: boolean;
}

export function Card({
  title,
  subtitle,
  children,
  style,
  padded = true,
}: CardProps) {
  return (
    <View style={[styles.container, padded && styles.padded, style]}>
      {(title || subtitle) && (
        <View style={styles.header}>
          {title && <Text style={styles.title}>{title}</Text>}
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#1e1b4b",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.15)",
    overflow: "hidden",
  },
  padded: {
    padding: 16,
  },
  header: {
    marginBottom: 12,
    gap: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: "#ffffff",
  },
  subtitle: {
    fontSize: 13,
    color: "#a5b4fc",
  },
});
