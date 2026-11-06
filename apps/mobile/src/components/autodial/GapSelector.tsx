import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Clock } from "lucide-react-native";

interface GapSelectorProps {
  currentGapSec: number;
  onSelectGap: (sec: number) => void;
}

const GAP_OPTIONS = [
  { sec: 3, label: "3s", mode: "Aggressive" },
  { sec: 5, label: "5s", mode: "Standard" },
  { sec: 8, label: "8s", mode: "Relaxed" },
  { sec: 10, label: "10s", mode: "Training" },
];

export const GapSelector: React.FC<GapSelectorProps> = ({
  currentGapSec,
  onSelectGap,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Clock size={15} color="#64748B" strokeWidth={2} />
        <Text style={styles.title}>Pacing Gap Duration</Text>
      </View>
      <View style={styles.optionsRow}>
        {GAP_OPTIONS.map((opt) => {
          const isSelected = currentGapSec === opt.sec;
          return (
            <TouchableOpacity
              key={opt.sec}
              style={[styles.gapPill, isSelected && styles.gapPillSelected]}
              onPress={() => onSelectGap(opt.sec)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.gapPillNumber,
                  isSelected && styles.gapPillNumberSelected,
                ]}
              >
                {opt.label}
              </Text>
              <Text
                style={[
                  styles.gapPillMode,
                  isSelected && styles.gapPillModeSelected,
                ]}
              >
                {opt.mode}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EEF2F6",
    marginHorizontal: 16,
    marginTop: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  title: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  optionsRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
  },
  gapPill: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  gapPillSelected: {
    backgroundColor: "#EFF6FF",
    borderColor: "#2E7FE8",
  },
  gapPillNumber: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
  },
  gapPillNumberSelected: {
    color: "#2E7FE8",
  },
  gapPillMode: {
    fontSize: 10,
    fontWeight: "500",
    color: "#94A3B8",
    marginTop: 1,
  },
  gapPillModeSelected: {
    color: "#256FD6",
    fontWeight: "600",
  },
});

