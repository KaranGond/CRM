import { requireNativeModule, EventEmitter } from "expo-modules-core";

export interface Subscription {
  remove(): void;
}

export interface SimInfo {
  slotIndex: number;
  displayName: string;
  carrierName: string;
  subscriptionId: number;
  iccId?: string;
  countryIso?: string;
}

export interface SetupStatus {
  callPhoneGranted: boolean;
  readPhoneStateGranted: boolean;
  readCallLogGranted: boolean;
  batteryOptimizationsIgnored: boolean;
  recorderFolderGranted: boolean;
  recorderFolderUri?: string;
}

export interface DeviceDetails {
  manufacturer: string;
  brand: string;
  model: string;
  androidVersion: string;
  sdkInt: number;
  defaultDialerPackage: string;
  isGoogleDialer: boolean;
  recommendedFolder: string;
  guidanceMessage: string;
  isRecordingSupported: boolean;
}

export interface PendingDispositionCall {
  callId: string;
  leadId?: string;
  numberE164: string;
  startedAt: string;
  endedAt: string;
  durationSec: number;
  outcome: string;
  sim?: string;
  dedupeKey: string;
}

export interface CallEndedEvent {
  callId: string;
  leadId?: string;
  numberE164: string;
  durationSec: number;
  outcome: "CONNECTED" | "NOT_CONNECTED" | "MISSED" | "REJECTED";
  sim?: string;
}

export interface CallHistoryItem {
  id: string;
  dedupeKey: string;
  deviceId?: string;
  leadId?: string;
  numberE164: string;
  startedAt: number;
  endedAt: number;
  durationSec: number;
  outcome: string;
  sim: string;
  direction: string;
  origin: string;
  dispositionId?: string;
  remark?: string;
  followUpAt?: string;
  recordingUri?: string;
  recordingStatus?: string;
  syncStatus?: string;
}

export interface SyncStatusEvent {
  pendingCount: number;
  lastSyncAt?: string;
  lastError?: string;
}

// Fallback or native module
let nativeModule: any = null;
try {
  nativeModule = requireNativeModule("telephony-engine");
} catch {
  // Mock fallback for Expo Go or Web dev preview
  nativeModule = {
    setAuth: async () => {},
    clearAuth: async () => {},
    getAccessToken: async () => "mock-token",
    getSetupStatus: async (): Promise<SetupStatus> => ({
      callPhoneGranted: true,
      readPhoneStateGranted: true,
      readCallLogGranted: true,
      batteryOptimizationsIgnored: true,
      recorderFolderGranted: true,
    }),
    listSims: async (): Promise<SimInfo[]> => [
      { slotIndex: 0, displayName: "SIM 1 (Jio)", carrierName: "Jio 5G", subscriptionId: 1 },
      { slotIndex: 1, displayName: "SIM 2 (Airtel)", carrierName: "Airtel", subscriptionId: 2 },
    ],
    dial: async (leadId: string, number: string, simSlot?: number) => {
      console.log(`[TelephonyEngine Mock] Dialing ${number} on SIM ${simSlot ?? 0}`);
    },
    simulateCall: async (
      leadId: string,
      number: string,
      durationSec = 30,
      outcome = "CONNECTED",
      simSlot = 0,
    ) => {
      return {
        success: true,
        callId: `mock_call_${Date.now()}`,
        dedupeKey: `mock_dedupe_${Date.now()}`,
        durationSec,
        outcome,
        sim: `SIM${simSlot + 1}`,
      };
    },
    listPendingDispositions: async (): Promise<PendingDispositionCall[]> => [],
    getCallHistory: async (limit?: number): Promise<CallHistoryItem[]> => [],
    saveDisposition: async () => {},
    syncNow: async () => ({ pendingCount: 0 }),
    setConfig: async () => {},
    setRecorderFolder: async () => {},
    scanRecordings: async () => ({ matchedCount: 0, totalFilesFound: 0 }),
    reconcileCallLog: async () => ({ reconciledCount: 0, calls: [] }),
    getDiagnostics: async () => ({ status: "OK", outboxCount: 0 }),
    getDeviceDetails: async (): Promise<DeviceDetails> => ({
      manufacturer: "samsung",
      brand: "samsung",
      model: "Galaxy M15 5G",
      androidVersion: "14",
      sdkInt: 34,
      defaultDialerPackage: "com.samsung.android.dialer",
      isGoogleDialer: false,
      recommendedFolder: "Recordings/Call",
      guidanceMessage:
        "Native OEM dialer active. Ensure 'Auto record calls' is enabled in Phone Settings.",
      isRecordingSupported: true,
    }),
  };
}

const emitter: any = new (EventEmitter as any)(nativeModule);

export const TelephonyEngine = {
  // Commands
  setAuth(apiBase: string, accessToken: string, refreshToken: string): Promise<void> {
    return nativeModule.setAuth(apiBase, accessToken, refreshToken);
  },

  clearAuth(): Promise<void> {
    return nativeModule.clearAuth();
  },

  getAccessToken(): Promise<string | null> {
    return nativeModule.getAccessToken();
  },

  getSetupStatus(): Promise<SetupStatus> {
    return nativeModule.getSetupStatus();
  },

  getDeviceDetails(): Promise<DeviceDetails> {
    return nativeModule.getDeviceDetails();
  },

  listSims(): Promise<SimInfo[]> {
    return nativeModule.listSims();
  },

  dial(leadId: string, number: string, simSlot?: number): Promise<void> {
    return nativeModule.dial(leadId, number, simSlot ?? 0);
  },

  simulateCall(
    leadId: string,
    number: string,
    durationSec = 30,
    outcome = "CONNECTED",
    simSlot = 0,
  ): Promise<{
    success: boolean;
    callId: string;
    dedupeKey: string;
    durationSec: number;
    outcome: string;
    sim: string;
  }> {
    return nativeModule.simulateCall(leadId, number, durationSec, outcome, simSlot);
  },

  listPendingDispositions(): Promise<PendingDispositionCall[]> {
    return nativeModule.listPendingDispositions();
  },

  getCallHistory(limit?: number): Promise<CallHistoryItem[]> {
    return nativeModule.getCallHistory(limit || 50);
  },

  saveDisposition(
    callId: string,
    dispositionId: string,
    remark?: string,
    followUpAt?: string,
  ): Promise<void> {
    return nativeModule.saveDisposition(callId, dispositionId, remark, followUpAt);
  },

  syncNow(): Promise<{ pendingCount: number }> {
    return nativeModule.syncNow();
  },

  setConfig(config: Record<string, any>): Promise<void> {
    return nativeModule.setConfig(config);
  },

  setRecorderFolder(uri: string): Promise<void> {
    return nativeModule.setRecorderFolder(uri);
  },

  scanRecordings(): Promise<{ matchedCount: number; totalFilesFound?: number }> {
    return nativeModule.scanRecordings();
  },

  reconcileCallLog(sinceTimestampMs: number): Promise<{ reconciledCount: number; calls: any[] }> {
    return nativeModule.reconcileCallLog(sinceTimestampMs);
  },

  getDiagnostics(): Promise<Record<string, any>> {
    return nativeModule.getDiagnostics();
  },

  // Events
  onCallEnded(listener: (event: CallEndedEvent) => void): Subscription {
    return emitter.addListener("callEnded", listener);
  },

  onSyncStatus(listener: (event: SyncStatusEvent) => void): Subscription {
    return emitter.addListener("syncStatus", listener);
  },

  onPermissionChanged(listener: () => void): Subscription {
    return emitter.addListener("permissionChanged", listener);
  },
};

export default TelephonyEngine;
