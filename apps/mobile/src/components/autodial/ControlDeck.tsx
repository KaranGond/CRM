import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import {
  PhoneCall,
  Pause,
  Play,
  SkipForward,
  Square,
} from "lucide-react-native";

interface ControlDeckProps {
  isPaused: boolean;
  status: string;
  onPause: () => void;
  onResume: () => void;
  onSkip: () => void;
  onDialNow: () => void;
  onStop: () => void;
}

export const ControlDeck: React.FC<ControlDeckProps> = ({
  isPaused,
  status,
  onPause,
  onResume,
  onSkip,
  onDialNow,
  onStop,
}) => {
  return (
    <View style={styles.container}>
      {/* Primary Big CTA: Dial Now */}
      <TouchableOpacity
        style={styles.dialNowButton}
        onPress={onDialNow}
        activeOpacity={0.8}
      >
        <PhoneCall size={20} color="#FFFFFF" strokeWidth={2.2} />
        <Text style={styles.dialNowText}>Dial Now</Text>
      </TouchableOpacity>

      {/* Action Row: Pause/Resume, Skip, Stop */}
      <View style={styles.actionsRow}>
        {/* Pause / Resume */}
        <TouchableOpacity
          style={[styles.secondaryButton, isPaused && styles.resumeButtonActive]}
          onPress={isPaused ? onResume : onPause}
          activeOpacity={0.7}
        >
          {isPaused ? (
            <>
              <Play size={18} color="#D97706" strokeWidth={2} />
              <Text style={[styles.secondaryText, { color: "#D97706" }]}>Resume</Text>
            </>
          ) : (
            <>
              <Pause size={18} color="#475569" strokeWidth={2} />
              <Text style={styles.secondaryText}>Pause</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Skip Lead */}
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={onSkip}
          activeOpacity={0.7}
        >
          <SkipForward size={18} color="#475569" strokeWidth={2} />
          <Text style={styles.secondaryText}>Skip Lead</Text>
        </TouchableOpacity>

        {/* Stop Session */}
        <TouchableOpacity
          style={[styles.secondaryButton, styles.stopButton]}
          onPress={onStop}
          activeOpacity={0.7}
        >
          <Square size={17} color="#DC2626" strokeWidth={2} />
          <Text style={[styles.secondaryText, { color: "#DC2626" }]}>End</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  dialNowButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2E7FE8",
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    shadowColor: "#2E7FE8",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  dialNowText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  resumeButtonActive: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
  },
  stopButton: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  secondaryText: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "600",
  },
});

