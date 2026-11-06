import { useState, useEffect, useRef, useCallback } from "react";
import { Alert } from "react-native";
import { TelephonyEngine } from "../../modules/telephony-engine";
import { CachedLead, sqliteStore } from "../store/sqliteStore";

export type AutoDialerStatus =
  | "IDLE"
  | "QUEUE_LOADED"
  | "LEAD_PREVIEW"
  | "COUNTDOWN"
  | "DIALING"
  | "IN_CALL"
  | "DISPOSITION"
  | "ADVANCING"
  | "PAUSED"
  | "COMPLETED";

export interface AutoDialerState {
  status: AutoDialerStatus;
  isActive: boolean;
  isPaused: boolean;
  countdownSec: number;
  currentLead: CachedLead | null;
  currentLeadIndex: number;
  totalQueueCount: number;
  dialedCount: number;
  connectedCount: number;
  totalTalkTimeSec: number;
  connectRate: number;
  callGapSec: number;
}

export function useAutoDialer(
  queue: CachedLead[],
  selectedSimSlot: number,
  onCallInitiated: (lead: CachedLead) => void,
  defaultGapSec: number = 5,
) {
  const [status, setStatus] = useState<AutoDialerStatus>("IDLE");
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [callGapSec, setCallGapSecState] = useState(defaultGapSec);
  const [countdownSec, setCountdownSec] = useState(defaultGapSec);
  const [currentLeadIndex, setCurrentLeadIndex] = useState(0);
  const [dialedCount, setDialedCount] = useState(0);
  const [connectedCount, setConnectedCount] = useState(0);
  const [totalTalkTimeSec, setTotalTalkTimeSec] = useState(0);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Active queue filtering out any lead marked with dnd === true
  const cleanQueue = queue.filter((lead) => !lead.dnd);
  const currentLead = cleanQueue[currentLeadIndex] || null;

  // Initialize persisted pacing gap from sqliteStore
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const savedGap = await sqliteStore.getSyncMetaValue("cfg_autodial_gap_sec");
        if (savedGap && isMounted) {
          const parsed = parseInt(savedGap, 10);
          if ([3, 5, 8, 10].includes(parsed)) {
            setCallGapSecState(parsed);
            if (!isActive) {
              setCountdownSec(parsed);
            }
          }
        }
      } catch {
        // Fallback to default
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [isActive]);

  const setCallGapSec = useCallback(
    async (sec: number) => {
      setCallGapSecState(sec);
      if (status === "COUNTDOWN" || status === "LEAD_PREVIEW" || status === "IDLE") {
        setCountdownSec(sec);
      }
      try {
        await sqliteStore.updateSyncMeta("cfg_autodial_gap_sec", String(sec));
      } catch {
        // Ignored in non-persistent contexts
      }
    },
    [status],
  );

  // Clear timer helper
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /**
   * Rule: Calling-hours validation (9:00 AM to 8:00 PM IST default)
   */
  const isWithinCallingHours = useCallback((): boolean => {
    const now = new Date();
    // UTC+5:30 (India Standard Time)
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const ist = new Date(utc + 3600000 * 5.5);
    const hour = ist.getHours();
    return hour >= 9 && hour < 20;
  }, []);

  const dialLead = useCallback(
    async (lead: CachedLead) => {
      clearTimer();
      setStatus("DIALING");
      try {
        onCallInitiated(lead);
        await TelephonyEngine.dial(lead.id, lead.phoneE164, selectedSimSlot);
        setDialedCount((prev) => prev + 1);
        setStatus("IN_CALL");
      } catch (err: any) {
        Alert.alert("Auto-Dialer Error", err.message || "Failed to place call");
        setIsPaused(true);
        setStatus("PAUSED");
      }
    },
    [clearTimer, onCallInitiated, selectedSimSlot],
  );

  // Immediate dial bypass (Task 1 & Gate 3)
  const dialNow = useCallback(() => {
    if (!currentLead) return;
    if (!isWithinCallingHours()) {
      Alert.alert(
        "Outside Calling Hours",
        "Current time is outside standard business calling hours (9:00 AM - 8:00 PM IST). Auto-dialer paused.",
      );
      setIsPaused(true);
      setStatus("PAUSED");
      return;
    }
    clearTimer();
    setCountdownSec(0);
    dialLead(currentLead);
  }, [currentLead, isWithinCallingHours, clearTimer, dialLead]);

  // Countdown loop
  useEffect(() => {
    if (!isActive || isPaused || !currentLead) {
      clearTimer();
      return;
    }

    if (status !== "COUNTDOWN" && status !== "LEAD_PREVIEW") {
      return;
    }

    if (countdownSec > 0) {
      timerRef.current = setTimeout(() => {
        setCountdownSec((prev) => prev - 1);
      }, 1000);
    } else {
      // Countdown finished -> dial
      if (!isWithinCallingHours()) {
        Alert.alert(
          "Outside Calling Hours",
          "Current time is outside standard business calling hours (9:00 AM - 8:00 PM IST). Auto-dialer paused.",
        );
        setIsPaused(true);
        setStatus("PAUSED");
        return;
      }
      dialLead(currentLead);
    }

    return () => clearTimer();
  }, [isActive, isPaused, countdownSec, currentLead, status, isWithinCallingHours, dialLead, clearTimer]);

  const startAutoDialer = useCallback(
    (gapSec?: number) => {
      if (cleanQueue.length === 0) {
        Alert.alert("Queue Empty", "No eligible leads available to auto-dial.");
        return;
      }
      if (!isWithinCallingHours()) {
        Alert.alert(
          "Outside Calling Hours",
          "Auto-dialing is restricted outside 9:00 AM - 8:00 PM IST.",
        );
        return;
      }
      const actualGap = gapSec || callGapSec;
      setIsActive(true);
      setIsPaused(false);
      setStatus("COUNTDOWN");
      setCountdownSec(actualGap);
    },
    [cleanQueue.length, isWithinCallingHours, callGapSec],
  );

  const pauseAutoDialer = useCallback(() => {
    setIsPaused(true);
    setStatus("PAUSED");
    clearTimer();
  }, [clearTimer]);

  const resumeAutoDialer = useCallback(() => {
    if (!isWithinCallingHours()) {
      Alert.alert(
        "Outside Calling Hours",
        "Cannot resume: Outside official calling hours (9:00 AM - 8:00 PM IST).",
      );
      return;
    }
    setIsPaused(false);
    setStatus("COUNTDOWN");
    setCountdownSec(callGapSec);
  }, [isWithinCallingHours, callGapSec]);

  const skipLead = useCallback(() => {
    clearTimer();
    if (currentLeadIndex + 1 < cleanQueue.length) {
      setCurrentLeadIndex((prev) => prev + 1);
      setCountdownSec(callGapSec);
      setStatus("COUNTDOWN");
    } else {
      Alert.alert("Queue Complete", "Reached end of call queue.");
      stopAutoDialer();
    }
  }, [clearTimer, currentLeadIndex, cleanQueue.length, callGapSec]);

  const stopAutoDialer = useCallback(() => {
    clearTimer();
    setIsActive(false);
    setIsPaused(false);
    setStatus("IDLE");
    setCurrentLeadIndex(0);
    setCountdownSec(callGapSec);
  }, [clearTimer, callGapSec]);

  const advanceToNextAfterDisposition = useCallback(() => {
    if (!isActive) return;
    setStatus("ADVANCING");
    if (currentLeadIndex + 1 < cleanQueue.length) {
      setCurrentLeadIndex((prev) => prev + 1);
      setCountdownSec(callGapSec);
      setIsPaused(false);
      setStatus("COUNTDOWN");
    } else {
      setStatus("COMPLETED");
      Alert.alert("Queue Complete", "All queue leads called for this session.");
      stopAutoDialer();
    }
  }, [isActive, currentLeadIndex, cleanQueue.length, callGapSec, stopAutoDialer]);

  const recordCallConnected = useCallback((durationSec: number = 0) => {
    setConnectedCount((prev) => prev + 1);
    setTotalTalkTimeSec((prev) => prev + durationSec);
  }, []);

  const connectRate = dialedCount > 0 ? Math.round((connectedCount / dialedCount) * 100) : 0;

  return {
    status,
    setStatus,
    isActive,
    isPaused,
    countdownSec,
    currentLead,
    currentLeadIndex,
    totalQueueCount: cleanQueue.length,
    dialedCount,
    connectedCount,
    totalTalkTimeSec,
    connectRate,
    callGapSec,
    setCallGapSec,
    startAutoDialer,
    pauseAutoDialer,
    resumeAutoDialer,
    skipLead,
    dialNow,
    stopAutoDialer,
    advanceToNextAfterDisposition,
    recordCallConnected,
    isWithinCallingHours,
  };
}
