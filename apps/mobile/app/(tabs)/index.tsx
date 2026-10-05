import { View, Text, ScrollView, StyleSheet } from "react-native";
import { Card } from "@telecalling-crm/ui";
import {
  formatCallDuration,
  calcConversionRate,
} from "@telecalling-crm/utils";

const stats = [
  { label: "Total Leads", value: "1,250", icon: "👥" },
  { label: "Calls Today", value: "127", icon: "📞" },
  { label: "Active Campaigns", value: "5", icon: "📊" },
  { label: "Conversion Rate", value: `${calcConversionRate(156, 1250)}%`, icon: "🎯" },
  { label: "Avg. Call Duration", value: formatCallDuration(185), icon: "⏱️" },
  { label: "Active Agents", value: "24", icon: "🧑‍💼" },
];

export default function DashboardScreen() {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Telecalling CRM</Text>
        <Text style={styles.subtitle}>Dashboard Overview</Text>
      </View>

      {/* Stats Grid */}
      <View style={styles.grid}>
        {stats.map((stat) => (
          <Card key={stat.label} style={styles.statCard}>
            <Text style={styles.statIcon}>{stat.icon}</Text>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </Card>
        ))}
      </View>

      {/* Ready Banner */}
      <Card style={styles.banner}>
        <Text style={styles.bannerTitle}>🚀 Monorepo is set up and ready</Text>
        <Text style={styles.bannerText}>
          Shared types, validation, utils, and UI components are wired across
          NestJS API, Next.js Web, and Expo Mobile.
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a1a",
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#a5b4fc",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: "#6b7280",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    width: "47%",
    padding: 16,
  },
  statIcon: {
    fontSize: 22,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 26,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: "#a5b4fc",
  },
  banner: {
    padding: 20,
    alignItems: "center",
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 8,
    textAlign: "center",
  },
  bannerText: {
    fontSize: 13,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 20,
  },
});
