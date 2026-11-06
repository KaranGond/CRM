import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";

interface CountdownRingProps {
  countdownSec: number;
  maxSec: number;
  isPaused: boolean;
  status: string;
}

export const CountdownRing: React.FC<CountdownRingProps> = ({
  countdownSec,
  maxSec,
  isPaused,
  status,
}) => {
  const size = 180;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const validMax = maxSec > 0 ? maxSec : 5;
  const progress = Math.max(0, Math.min(1, countdownSec / validMax));
  const strokeDashoffset = circumference * (1 - progress);

  let ringColor = "#2E7FE8"; // Azure Blue default
  if (isPaused) {
    ringColor = "#F59E0B"; // Amber
  } else if (status === "DIALING" || countdownSec === 0) {
    ringColor = "#10B981"; // Emerald Green
  }

  return (
    <View style={styles.container}>
      <Svg width={size} height={size} style={styles.svg}>
        {/* Background track circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E2E8F0"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Animated countdown progress ring */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={ringColor}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>

      <View style={styles.centerTextContainer}>
        {isPaused ? (
          <>
            <Text style={[styles.mainCountText, { color: "#D97706" }]}>PAUSED</Text>
            <Text style={styles.subLabel}>Tap Resume to continue</Text>
          </>
        ) : status === "DIALING" || countdownSec === 0 ? (
          <>
            <Text style={[styles.mainCountText, { color: "#059669", fontSize: 26 }]}>
              DIALING...
            </Text>
            <Text style={styles.subLabel}>Connecting via SIM</Text>
          </>
        ) : (
          <>
            <Text style={styles.mainCountText}>{countdownSec}</Text>
            <Text style={styles.subLabel}>Auto-dialing next</Text>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 18,
    position: "relative",
  },
  svg: {
    transform: [{ rotateZ: "0deg" }],
  },
  centerTextContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    width: 140,
    height: 140,
  },
  mainCountText: {
    fontSize: 46,
    fontWeight: "800",
    color: "#1E293B",
    letterSpacing: -1,
  },
  subLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 2,
    textAlign: "center",
  },
});

