import React from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  TrendingUp,
  Clock,
  Zap,
  Target,
} from "lucide-react-native";

interface SessionHUDProps {
  dialedCount: number;
  currentLeadIndex: number;
  totalQueueCount: number;
  connectRate: number;
  callGapSec: number;
  talkTimeSec: number;
}

export const SessionHUD: React.FC<SessionHUDProps> = ({
  dialedCount,
  currentLeadIndex,
  totalQueueCount,
  connectRate,
  callGapSec,
  talkTimeSec,
}) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `${hrs}h ${remMins}m`;
    }
    return `${mins}m ${secs}s`;
  };

  return (
    <View style={styles.hudCard}>
      {/* Metric 1: Progress */}
      <View style={styles.metricItem}>
        <View style={styles.iconLabelRow}>
          <Target size={13} color="#2E7FE8" strokeWidth={2.2} />
          <Text style={styles.metricLabel}>Progress</Text>
        </View>
        <Text style={styles.metricValue}>
          {Math.min(currentLeadIndex + 1, totalQueueCount)} / {totalQueueCount}
        </Text>
      </View>

      <View style={styles.divider} />

      {/* Metric 2: Connect Rate */}
      <View style={styles.metricItem}>
        <View style={styles.iconLabelRow}>
          <TrendingUp size={13} color="#10B981" strokeWidth={2.2} />
          <Text style={styles.metricLabel}>Connect</Text>
        </View>
        <Text style={[styles.metricValue, { color: "#059669" }]}>
          {connectRate}%
        </Text>
      </View>

      <View style={styles.divider} />

      {/* Metric 3: Talk Time */}
      <View style={styles.metricItem}>
        <View style={styles.iconLabelRow}>
          <Clock size={13} color="#8B5CF6" strokeWidth={2.2} />
          <Text style={styles.metricLabel}>Talk Time</Text>
        </View>
        <Text style={styles.metricValue}>{formatTime(talkTimeSec)}</Text>
      </View>

      <View style={styles.divider} />

      {/* Metric 4: Pacing Gap */}
      <View style={styles.metricItem}>
        <View style={styles.iconLabelRow}>
          <Zap size={13} color="#F59E0B" strokeWidth={2.2} />
          <Text style={styles.metricLabel}>Pacing</Text>
        </View>
        <Text style={[styles.metricValue, { color: "#D97706" }]}>
          {callGapSec}s gap
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  hudCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EEF2F6",
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  metricItem: {
    flex: 1,
    alignItems: "center",
  },
  iconLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748B",
    textTransform: "uppercase",
  },
  metricValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E293B",
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: "#F1F5F9",
  },
});

