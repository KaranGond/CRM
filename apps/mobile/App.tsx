import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
  Dimensions,
  SafeAreaView,
  RefreshControl,
  AppState,
} from "react-native";
import { StatusBar } from "expo-status-bar";

// Plain Line Lucide Icons matching "4. Icons I recommend for your CRM"
import {
  LayoutGrid,
  Users,
  Phone,
  PhoneCall,
  Calendar,
  MessageCircle,
  MessageSquare,
  TrendingUp,
  BarChart2,
  Headphones,
  Bell,
  Settings,
  FileText,
  Database,
  Search,
  Plus,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Smartphone,
  RefreshCw,
  SlidersHorizontal,
  ArrowRight,
  Clock,
  AlertTriangle,
  Sparkles,
  User,
  MapPin,
  Zap,
  X,
  Building2,
  ShieldCheck,
  Flame,
  Cloud,
} from "lucide-react-native";

import TelephonyEngine, {
  CallEndedEvent,
  SyncStatusEvent,
  SimInfo,
} from "./modules/telephony-engine";
import { sqliteStore, CachedLead, CachedCall } from "./src/store/sqliteStore";
import { useAutoDialer } from "./src/autodialer/useAutoDialer";
import { AutoDialCockpit } from "./src/components/autodial";

// --- Color Palette: Calibrated from Design Mockup ---
const THEME = {
  bg: "#F8FAFC",
  card: "#FFFFFF",
  border: "#EEF2F6",
  borderLight: "#F1F5F9",
  primary: "#2E7FE8", // Electric Azure Blue from mockup
  primaryHover: "#256FD6",
  primaryLight: "#EFF6FF",
  primarySoft: "#DBEAFE",
  text: "#1E293B",
  textSecondary: "#64748B",
  textMuted: "#94A3B8",
  green: "#10B981",
  greenLight: "#ECFDF5",
  greenText: "#059669",
  amber: "#F59E0B",
  amberLight: "#FFFBEB",
  amberText: "#D97706",
  purple: "#8B5CF6",
  purpleLight: "#F5F3FF",
  purpleText: "#7C3AED",
  red: "#EF4444",
  redLight: "#FEF2F2",
  redText: "#DC2626",
};

const DEFAULT_SERVER_URL = "http://localhost:4000/api";

export default function App() {
  const [activeTab, setActiveTab] = useState<"home" | "queue" | "reports" | "settings" | "history">("home");
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);
  const [leads, setLeads] = useState<CachedLead[]>([]);
  const [callLogs, setCallLogs] = useState<CachedCall[]>([]);
  const [sims, setSims] = useState<SimInfo[]>([]);
  const [selectedSimSlot, setSelectedSimSlot] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>("Never");
  const [isSimulationMode, setIsSimulationMode] = useState<boolean>(false);
  const [showDevSettings, setShowDevSettings] = useState<boolean>(false);

  // Telephony permissions & device health
  const [setupStatus, setSetupStatus] = useState<any>(null);
  const [deviceDetails, setDeviceDetails] = useState<any>(null);

  // Filters & Search
  const [leadSearchQuery, setLeadSearchQuery] = useState("");
  const [leadStageFilter, setLeadStageFilter] = useState("all");
  const [reportsSubTab, setReportsSubTab] = useState<"team" | "funnel">("team");

  // Modals
  const [leadDetailsModalVisible, setLeadDetailsModalVisible] = useState(false);
  const [selectedLeadDetails, setSelectedLeadDetails] = useState<CachedLead | null>(null);
  const [leadDetailsTab, setLeadDetailsTab] = useState<"details" | "notes">("details");

  const [dispositionModalVisible, setDispositionModalVisible] = useState(false);
  const [activeLead, setActiveLead] = useState<CachedLead | null>(null);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [callOutcome, setCallOutcome] = useState<"connected" | "not_picked" | "busy" | "switched_off">("connected");
  const [selectedDisposition, setSelectedDisposition] = useState("Interested");
  const [followUpDays, setFollowUpDays] = useState(1);
  const [quickCallbackMinutes, setQuickCallbackMinutes] = useState<number | null>(null);
  const [callRemark, setCallRemark] = useState("");
  const [dealAmount, setDealAmount] = useState("");
  const [sendWhatsAppAfterSave, setSendWhatsAppAfterSave] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(true);

  // Lead micro actions modal
  const [leadActionModalVisible, setLeadActionModalVisible] = useState(false);
  const [actionLead, setActionLead] = useState<CachedLead | null>(null);
  const [actionModalType, setActionModalType] = useState<"note" | "reminder" | "stage">("note");
  const [actionNoteText, setActionNoteText] = useState("");
  const [quickActionReminderMinutes, setQuickActionReminderMinutes] = useState<number | null>(15);
  const [selectedActionStage, setSelectedActionStage] = useState("New Lead");

  // Add lead modal
  const [addLeadModalVisible, setAddLeadModalVisible] = useState(false);
  const [newLeadName, setNewLeadName] = useState("");
  const [newLeadPhone, setNewLeadPhone] = useState("");
  const [newLeadStage, setNewLeadStage] = useState("New Lead");
  const [newLeadNotes, setNewLeadNotes] = useState("");

  // Phase 3: Offline lease, consent & calibration state
  const [syncMeta, setSyncMeta] = useState<any>(null);
  const [pendingMutationsCount, setPendingMutationsCount] = useState<number>(0);
  const [setupWizardVisible, setSetupWizardVisible] = useState<boolean>(false);
  const [verbalConsentGiven, setVerbalConsentGiven] = useState<boolean>(true);

  // Dismissed missed calls
  const [dismissedMissedIds, setDismissedMissedIds] = useState<Set<string>>(new Set());

  // Section 4 Architecture: Work SIM policy & Tier-3 Unknown Call banner
  const [workSimSlot, setWorkSimSlot] = useState<string>("-1");
  const [ignoredUnknownNumber, setIgnoredUnknownNumber] = useState<string | null>(null);

  // AutoDialer Hook
  const {
    status: autoDialStatus,
    isActive: isAutoDialActive,
    isPaused: isAutoDialPaused,
    countdownSec,
    currentLead: autoDialCurrentLead,
    currentLeadIndex: autoDialLeadIndex,
    totalQueueCount: autoDialTotalQueueCount,
    dialedCount: autoDialDialedCount,
    connectedCount: autoDialConnectedCount,
    totalTalkTimeSec: autoDialTalkTimeSec,
    connectRate: autoDialConnectRate,
    callGapSec,
    setCallGapSec,
    startAutoDialer,
    pauseAutoDialer,
    resumeAutoDialer,
    skipLead: autoDialSkipLead,
    dialNow: autoDialDialNow,
    stopAutoDialer,
    advanceToNextAfterDisposition,
    recordCallConnected,
  } = useAutoDialer(leads, selectedSimSlot, (lead) => handleDial(lead), 5);

  const stagesList = ["New Lead", "Follow-up", "In Progress", "Qualified", "Deal Won", "Lost"];
  const dispositionsList = [
    { id: "disp_1", label: "Interested" },
    { id: "disp_2", label: "Follow-up Required" },
    { id: "disp_3", label: "Meeting Scheduled" },
    { id: "disp_4", label: "Quotation Sent" },
    { id: "disp_5", label: "Rooftop Inspection" },
    { id: "disp_6", label: "Not Interested" },
    { id: "disp_7", label: "Wrong Number" },
  ];

  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    try {
      await sqliteStore.init();
      const cached = await sqliteStore.getCachedLeads();
      if (cached.length > 0) {
        setLeads(cached);
        const lookupItems: Array<{ id: string; name: string; phoneE164: string }> = [];
        for (const l of cached) {
          if (l.phoneE164) lookupItems.push({ id: l.id, name: l.name, phoneE164: l.phoneE164 });
          if (Array.isArray(l.altPhones)) {
            for (const alt of l.altPhones) {
              if (alt) lookupItems.push({ id: l.id, name: `${l.name} (Alt)`, phoneE164: alt });
            }
          }
        }
        await TelephonyEngine.syncLeadLookup(lookupItems);
      }
      const cachedCalls = await sqliteStore.getCachedCalls(100);
      if (cachedCalls.length > 0) {
        setCallLogs(cachedCalls);
      }
      const meta = await sqliteStore.getSyncMeta();
      setSyncMeta(meta);
      if (meta?.lastSyncAt) {
        setLastSyncTime(new Date(meta.lastSyncAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      }
      const pending = await sqliteStore.getPendingMutations();
      setPendingMutationsCount(pending.length);
    } catch (e) {
      console.warn("SQLite init warning:", e);
    }

    try {
      const savedSimMode = await sqliteStore.getSyncMetaValue("cfg_simulation_mode");
      // Default to "false" (Live Cellular Calls enabled for production).
      const simActive = savedSimMode === "true";
      setIsSimulationMode(simActive);
      await TelephonyEngine.setConfig({ simulation_mode: simActive ? "true" : "false" });
      const sList = await TelephonyEngine.listSims();
      setSims(sList || []);
      if (sList && sList.length > 0) {
        setSelectedSimSlot(sList[0].slotIndex);
      }
      const savedWorkSim = await sqliteStore.getSyncMetaValue("cfg_work_sim_slot");
      if (savedWorkSim) {
        setWorkSimSlot(savedWorkSim);
        await TelephonyEngine.setConfig({ work_sim_slot: savedWorkSim });
      }
    } catch (e) {
      console.warn("TelephonyEngine.listSims error:", e);
    }

    try {
      const devDetails = await TelephonyEngine.getDeviceDetails();
      setDeviceDetails(devDetails);
      const permStatus = await TelephonyEngine.getSetupStatus();
      setSetupStatus(permStatus);
    } catch (e) {
      console.warn("Device details error:", e);
    }

    executeAutoSync(true);
  };

  useEffect(() => {
    const callEndedSub = TelephonyEngine.onCallEnded(async (event: CallEndedEvent) => {
      console.log("CallEnded event received:", event);
      if (event.callId) {
        setActiveCallId(event.callId);
      }
      setCallOutcome(event.durationSec > 0 ? "connected" : "not_picked");
      if (event.durationSec > 0) {
        recordCallConnected(event.durationSec);
      }

      let matchedLead = leads.find((l) => l.id === event.leadId);
      if (!matchedLead && event.numberE164) {
        const clean10 = event.numberE164.replace(/\D/g, "").slice(-10);
        matchedLead = leads.find((l) => l.phoneE164.replace(/\D/g, "").slice(-10) === clean10);
      }
      if (matchedLead) {
        setActiveLead(matchedLead);
      }

      setDispositionModalVisible(true);
      await refreshCallLogs();
    });

    const syncStatusSub = TelephonyEngine.onSyncStatus((event: SyncStatusEvent) => {
      if (event.pendingCount > 0) setIsSyncing(true);
      else {
        setIsSyncing(false);
        setLastSyncTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      }
    });

    const unknownIgnoredSub = TelephonyEngine.onUnknownCallIgnored((event) => {
      console.log("Tier-3 Unknown Call Dropped (Privacy Protected):", event);
      setIgnoredUnknownNumber(event.numberE164);
    });

    const multipleLeadsSub = TelephonyEngine.onMultipleLeadsMatched((event) => {
      console.log("Section 3: Shared phone number detected:", event);
      Alert.alert(
        "Shared Number Detected",
        `Phone number ${event.numberE164} belongs to ${event.matchCount} different customer leads. Please select the specific customer from your queue.`
      );
    });

    return () => {
      callEndedSub.remove();
      syncStatusSub.remove();
      unknownIgnoredSub?.remove();
      multipleLeadsSub?.remove();
    };
  }, [leads]);

  // Periodic 30s background auto-refresh & AppState foreground sync
  useEffect(() => {
    const autoRefreshTimer = setInterval(() => {
      executeAutoSync(true);
    }, 30000);

    const appStateSub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        TelephonyEngine.getSetupStatus()
          .then((status) => {
            if (status) setSetupStatus(status);
          })
          .catch(() => {});
        executeAutoSync(true);
      }
    });

    return () => {
      clearInterval(autoRefreshTimer);
      appStateSub.remove();
    };
  }, [serverUrl]);

  const getAuthToken = async (): Promise<string | null> => {
    try {
      const res = await fetch(`${serverUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "caller1@telecalling.crm", password: "Password123!" }),
      });
      const data = await res.json();
      return data?.data?.accessToken || data?.accessToken || data?.token || null;
    } catch (e) {
      console.warn("getAuthToken error:", e);
      return null;
    }
  };

  const refreshCallLogs = async () => {
    try {
      const localCalls = await sqliteStore.getCachedCalls(100);
      const token = await getAuthToken();
      let serverCalls: any[] = [];
      if (token) {
        const res = await fetch(`${serverUrl}/calls?limit=50`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const sData = await res.json();
          serverCalls = Array.isArray(sData) ? sData : (sData.data || sData.calls || []);
        }
      }

      const mergedList: CachedCall[] = [...localCalls];
      const seenIds = new Set(localCalls.map((c) => c.id));
      const existingCachedMap = new Map<string, CachedCall>();
      for (const lc of localCalls) {
        if (lc.id) existingCachedMap.set(lc.id, lc);
        if (lc.numberE164) {
          const num10 = lc.numberE164.replace(/\D/g, "").slice(-10);
          if (num10) existingCachedMap.set(num10, lc);
        }
      }

      for (const sCall of serverCalls) {
        if (!seenIds.has(sCall.id)) {
          const s10 = (sCall.numberE164 || "").replace(/\D/g, "").slice(-10);
          const matchedLocal = existingCachedMap.get(sCall.id) || (s10 ? existingCachedMap.get(s10) : undefined);

          mergedList.push({
            id: sCall.id,
            numberE164: sCall.numberE164,
            leadName: sCall.lead?.name || matchedLocal?.leadName,
            direction: sCall.direction || "OUTBOUND",
            outcome: sCall.outcome || matchedLocal?.outcome || "CONNECTED",
            durationSec: sCall.durationSec || 0,
            startedAt: sCall.startedAt,
            endedAt: sCall.endedAt,
            dispositionId: sCall.dispositionId || matchedLocal?.dispositionId,
            dispositionLabel: sCall.disposition?.label || matchedLocal?.dispositionLabel,
            remark: sCall.remark || matchedLocal?.remark,
            followUpAt: sCall.followUpAt || matchedLocal?.followUpAt,
            sim: sCall.sim || "SIM 1",
            recordingStatus: sCall.recordingStatus || "NONE",
            recordingUri: sCall.recordingUri,
          });
          seenIds.add(sCall.id);
        }
      }

      mergedList.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
      setCallLogs(mergedList);
    } catch (err) {
      console.warn("Error refreshing call logs:", err);
    }
  };

  const handleDial = async (lead: CachedLead) => {
    try {
      if (syncMeta && !syncMeta.isLeaseValid) {
        Alert.alert(
          "72h Offline Lease Expired",
          "Your offline lease has expired (>72 hours). Please connect to Wi-Fi or cellular network to synchronize before dialing new calls.",
          [{ text: "Sync Now", onPress: () => executeAutoSync(false) }, { text: "Dismiss" }]
        );
        return;
      }
      setActiveLead(lead);
      const permCheck = await TelephonyEngine.getSetupStatus();
      if (!permCheck.callPhoneGranted) {
        Linking.openSettings();
      }
      const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      setActiveCallId(callId);

      await TelephonyEngine.dial(lead.id, lead.phoneE164, selectedSimSlot);
    } catch (err: any) {
      Alert.alert("Dial Error", err.message || "Failed to initiate phone call");
    }
  };

  const handleOpenWhatsApp = (phone: string, leadName?: string, customText?: string) => {
    const cleanPhone = phone.replace(/\D/g, "");
    const formatted = cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`;
    const greeting = customText || `Hello ${leadName || "there"}, thank you for speaking with our Solar Team!`;
    Linking.openURL(`whatsapp://send?phone=${formatted}&text=${encodeURIComponent(greeting)}`).catch(() => {
      Linking.openURL(`https://wa.me/${formatted}?text=${encodeURIComponent(greeting)}`).catch(() => {
        Alert.alert("WhatsApp Not Found", "Could not open WhatsApp on this device.");
      });
    });
  };

  const handleOpenSMS = (phone: string, leadName?: string) => {
    const cleanPhone = phone.replace(/\D/g, "");
    const text = `Hi ${leadName || ""}, thanks for connecting with us regarding rooftop solar. Reply to schedule a visit.`;
    Linking.openURL(`sms:${cleanPhone}?body=${encodeURIComponent(text)}`).catch(() => {
      Alert.alert("SMS Error", "Could not open default SMS application.");
    });
  };

  const handleSaveDisposition = async (advance: boolean = false) => {
    if (!activeCallId) {
      setDispositionModalVisible(false);
      return;
    }

    try {
      const dispObj = dispositionsList.find((d) => d.label === selectedDisposition);
      const dispositionId = dispObj?.id || "disp_general";
      const dispositionLabel = selectedDisposition;

      let followUpDate = new Date();
      if (quickCallbackMinutes !== null) {
        followUpDate = new Date(Date.now() + quickCallbackMinutes * 60 * 1000);
      } else {
        followUpDate.setDate(followUpDate.getDate() + followUpDays);
      }

      const trimmedDeal = dealAmount.trim();
      const finalRemark = trimmedDeal
        ? `${callRemark ? callRemark + " | " : ""}Deal: ₹${trimmedDeal}`
        : callRemark;

      try {
        await TelephonyEngine.saveDisposition(
          activeCallId,
          dispositionId,
          finalRemark,
          followUpDate.toISOString(),
        );
      } catch (nativeErr) {
        console.warn("native saveDisposition warning:", nativeErr);
      }

      const recordingStatus = deviceDetails?.isGoogleDialer ? "UNSUPPORTED_DEVICE" : "PENDING";
      await sqliteStore.enqueueMutation("DISPOSITION_SAVED", {
        callId: activeCallId,
        leadId: activeLead?.id,
        dispositionId,
        disposition: dispositionLabel,
        remark: finalRemark,
        dealAmount: trimmedDeal || undefined,
        followUpAt: followUpDate.toISOString(),
        recordingStatus,
        verbalConsentGiven,
        sendWhatsApp: sendWhatsAppAfterSave,
        templateId: selectedDisposition.toLowerCase().includes("interest")
          ? "solar_brochure_v1"
          : selectedDisposition.toLowerCase().includes("meeting")
          ? "site_inspection_confirm_v1"
          : "callback_scheduled_v1",
      });

      const pendingAfterMut = await sqliteStore.getPendingMutations();
      setPendingMutationsCount(pendingAfterMut.length);

      await sqliteStore.updateCachedCallDisposition(
        activeCallId,
        dispositionId,
        dispositionLabel,
        finalRemark,
        followUpDate.toISOString(),
      );

      if (activeLead) {
        await sqliteStore.removeCachedLead(activeLead.id);
        const updated = await sqliteStore.getCachedLeads();
        setLeads(updated);
      }

      const leadForWhatsApp = activeLead;
      const shouldTriggerWhatsApp = sendWhatsAppAfterSave && leadForWhatsApp?.phoneE164;

      setDispositionModalVisible(false);
      setCallRemark("");
      setDealAmount("");
      setQuickCallbackMinutes(null);
      setSendWhatsAppAfterSave(false);
      setActiveCallId(null);

      await refreshCallLogs();

      if (shouldTriggerWhatsApp && leadForWhatsApp) {
        let msg = `Hi ${leadForWhatsApp.name || ""}, thank you for speaking with us today!`;
        if (selectedDisposition.toLowerCase().includes("interested")) {
          msg = `Hi ${leadForWhatsApp.name || ""}, thanks for your interest! Sharing details with you here. Feel free to reply anytime.`;
        }
        setTimeout(() => {
          handleOpenWhatsApp(leadForWhatsApp.phoneE164, leadForWhatsApp.name, msg);
        }, 350);
      }

      if (isAutoDialActive) {
        advanceToNextAfterDisposition();
      } else if (advance) {
        const remaining = leads.filter((l) => l.id !== leadForWhatsApp?.id);
        if (remaining.length > 0) {
          setSelectedLeadDetails(remaining[0]);
          setLeadDetailsModalVisible(true);
        }
      }

      executeAutoSync(true);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to save disposition");
    }
  };

  const handleToggleSimulationMode = async (enabled: boolean) => {
    setIsSimulationMode(enabled);
    try {
      await TelephonyEngine.setConfig({ simulation_mode: enabled ? "true" : "false" });
      await sqliteStore.updateSyncMeta("cfg_simulation_mode", enabled ? "true" : "false");
      Alert.alert(
        enabled ? "Simulation Mode Active" : "Live Carrier Calling Enabled",
        enabled
          ? "Safe Testing Mode: Calls are simulated locally without dialing carrier network."
          : "Production Mode: Live cellular calls will be placed using SIM card airtime."
      );
    } catch (err: any) {
      console.warn("Toggle simulation mode error:", err);
    }
  };

  const executeAutoSync = async (silent: boolean = false) => {
    setIsSyncing(true);
    try {
      const token = await getAuthToken();
      try {
        await TelephonyEngine.scanRecordings();
      } catch (recScanErr) {}

      try {
        await TelephonyEngine.reconcileCallLog(Date.now() - 24 * 3600 * 1000);
      } catch (recErr) {}

      if (token) {
        // Flush offline mutations backlog
        try {
          const pending = await sqliteStore.getPendingMutations();
          if (pending && pending.length > 0) {
            const pushRes = await fetch(`${serverUrl}/sync/push`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                deviceId: deviceDetails?.id || "mobile-client",
                mutations: pending.map((m) => {
                  let parsedPayload: any = {};
                  try {
                    parsedPayload = JSON.parse(m.payloadJson);
                  } catch {
                    parsedPayload = {};
                  }
                  return {
                    mutationId: m.id,
                    type: m.mutationType,
                    payload: parsedPayload,
                  };
                }),
              }),
            });
            if (pushRes.ok) {
              for (const m of pending) {
                await sqliteStore.markMutationSynced(m.id);
              }
            }
          }
        } catch (pushErr) {
          console.warn("Outbox push note:", pushErr);
        }

        // Pull monotonic change feed cursor
        let nextCursor = 0;
        try {
          const currentMeta = await sqliteStore.getSyncMeta();
          const cur = currentMeta?.serverCursor || 0;
          const pullRes = await fetch(`${serverUrl}/sync/pull?cursor=${cur}&limit=50`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (pullRes.ok) {
            const pullData = await pullRes.json();
            if (pullData.data?.nextCursor) {
              nextCursor = pullData.data.nextCursor;
            }
          }
        } catch (pullErr) {
          console.warn("Sync pull note:", pullErr);
        }

        const res = await fetch(`${serverUrl}/me/queue`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const serverLeads = Array.isArray(data) ? data : (data.data || data.leads || []);
          if (serverLeads.length > 0) {
            const mappedLeads: CachedLead[] = serverLeads.map((sl: any) => ({
              id: sl.id,
              name: sl.name,
              phoneE164: sl.phoneE164,
              altPhones: Array.isArray(sl.altPhones) ? sl.altPhones : [],
              stage: sl.stage?.label || sl.stage || "New Lead",
              source: sl.source || "Web Portal",
              notes: sl.customFields?.notes || sl.notes || undefined,
              dnd: Boolean(sl.dnd),
              priority: typeof sl.priority === "number" ? sl.priority : undefined,
              nextFollowUpAt: sl.nextFollowUpAt || undefined,
              cachedAt: new Date().toISOString(),
            }));
            await sqliteStore.cacheLeads(mappedLeads);
            setLeads(mappedLeads);
            const lookupItems: Array<{ id: string; name: string; phoneE164: string }> = [];
            for (const l of mappedLeads) {
              if (l.phoneE164) lookupItems.push({ id: l.id, name: l.name, phoneE164: l.phoneE164 });
              if (Array.isArray(l.altPhones)) {
                for (const alt of l.altPhones) {
                  if (alt) lookupItems.push({ id: l.id, name: `${l.name} (Alt)`, phoneE164: alt });
                }
              }
            }
            await TelephonyEngine.syncLeadLookup(lookupItems);
          }
        }
        await sqliteStore.recordSyncSuccess(nextCursor || 1);
      } else {
        await sqliteStore.recordSyncSuccess(0);
      }

      await refreshCallLogs();
      const meta = await sqliteStore.getSyncMeta();
      setSyncMeta(meta);
      const pending = await sqliteStore.getPendingMutations();
      setPendingMutationsCount(pending.length);
      setLastSyncTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      if (!silent) Alert.alert("Sync Successful", "Leads and call history synced with CRM server.");
    } catch (e: any) {
      if (!silent) Alert.alert("Sync Offline", "Could not reach server. Working with local SQLite cache.");
    } finally {
      setIsSyncing(false);
    }
  };

  // Pull-to-refresh handler with top-to-bottom circular indicator
  const onPullToRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await executeAutoSync(true);
      await refreshCallLogs();
    } catch (e) {
      console.warn("Pull-to-refresh error:", e);
    } finally {
      setRefreshing(false);
    }
  }, [serverUrl]);

  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      const matchesSearch =
        l.name.toLowerCase().includes(leadSearchQuery.toLowerCase()) ||
        l.phoneE164.includes(leadSearchQuery) ||
        (l.source || "").toLowerCase().includes(leadSearchQuery.toLowerCase());
      const matchesStage =
        leadStageFilter === "all" ||
        l.stage.toLowerCase() === leadStageFilter.toLowerCase();
      return matchesSearch && matchesStage;
    });
  }, [leads, leadSearchQuery, leadStageFilter]);

  const missedNotCalledBack = useMemo(() => {
    const missed = callLogs.filter(
      (c) =>
        (c.durationSec || 0) === 0 &&
        c.direction === "INBOUND" &&
        !dismissedMissedIds.has(c.id),
    );
    const completedNumbers = new Set(
      callLogs
        .filter((c) => (c.durationSec || 0) > 0)
        .map((c) => (c.numberE164 || "").replace(/\D/g, "").slice(-10)),
    );
    return missed.filter((m) => {
      const m10 = (m.numberE164 || "").replace(/\D/g, "").slice(-10);
      return !completedNumbers.has(m10);
    });
  }, [callLogs, dismissedMissedIds]);

  const formatPhone = (p: string) => {
    if (!p) return "";
    const clean = p.replace(/\D/g, "");
    if (clean.length === 10) return `+91 ${clean.slice(0, 5)} ${clean.slice(5)}`;
    if (clean.length === 12 && clean.startsWith("91")) {
      return `+91 ${clean.slice(2, 7)} ${clean.slice(7)}`;
    }
    return p;
  };

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${rem.toString().padStart(2, "0")}`;
  };

  const formatDateTime = (iso: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} • ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  };

  const getInitials = (name?: string) => {
    if (!name) return "LD";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const openLeadActionModal = (lead: CachedLead, type: "note" | "reminder" | "stage") => {
    setActionLead(lead);
    setActionModalType(type);
    setActionNoteText(lead.notes || "");
    if (type === "stage") setSelectedActionStage(lead.stage || "New Lead");
    setLeadActionModalVisible(true);
  };

  const handleSaveLeadNote = async () => {
    if (!actionLead) return;
    try {
      await sqliteStore.updateCachedLead(actionLead.id, { notes: actionNoteText.trim() });
      await sqliteStore.enqueueMutation("LEAD_UPDATED", {
        leadId: actionLead.id,
        notes: actionNoteText.trim(),
      });
      const updated = await sqliteStore.getCachedLeads();
      setLeads(updated);
      setLeadActionModalVisible(false);
      executeAutoSync(true);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to save note");
    }
  };

  const handleSaveLeadReminder = async () => {
    if (!actionLead || quickActionReminderMinutes === null) return;
    try {
      const targetTime = new Date(Date.now() + quickActionReminderMinutes * 60 * 1000);
      await sqliteStore.updateCachedLead(actionLead.id, { nextFollowUpAt: targetTime.toISOString() });
      await sqliteStore.enqueueMutation("FOLLOWUP_CREATED", {
        leadId: actionLead.id,
        dueAt: targetTime.toISOString(),
        note: actionNoteText || "Follow-up reminder",
      });
      const updated = await sqliteStore.getCachedLeads();
      setLeads(updated);
      setLeadActionModalVisible(false);
      executeAutoSync(true);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to set callback");
    }
  };

  const handleSaveLeadStage = async () => {
    if (!actionLead) return;
    try {
      await sqliteStore.updateCachedLead(actionLead.id, { stage: selectedActionStage });
      await sqliteStore.enqueueMutation("LEAD_UPDATED", {
        leadId: actionLead.id,
        stage: selectedActionStage,
      });
      const updated = await sqliteStore.getCachedLeads();
      setLeads(updated);
      setLeadActionModalVisible(false);
      executeAutoSync(true);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update stage");
    }
  };

  const handleAddNewLead = async () => {
    if (!newLeadName.trim() || !newLeadPhone.trim()) {
      Alert.alert("Missing Fields", "Please enter contact name and phone number.");
      return;
    }
    const cleanDigits = newLeadPhone.replace(/\D/g, "");
    const formatted = cleanDigits.startsWith("91") ? `+${cleanDigits}` : `+91${cleanDigits}`;
    const newId = `local_lead_${Date.now()}`;

    try {
      const newLead: CachedLead = {
        id: newId,
        name: newLeadName.trim(),
        phoneE164: formatted,
        stage: newLeadStage,
        source: "Mobile App",
        notes: newLeadNotes.trim() || undefined,
        cachedAt: new Date().toISOString(),
      };

      await sqliteStore.cacheLeads([newLead]);
      await sqliteStore.enqueueMutation("LEAD_CREATED", {
        id: newId,
        name: newLead.name,
        phoneE164: newLead.phoneE164,
        stage: newLead.stage,
        source: newLead.source,
        notes: newLead.notes,
      });

      const updated = await sqliteStore.getCachedLeads();
      setLeads(updated);
      setAddLeadModalVisible(false);
      setNewLeadName("");
      setNewLeadPhone("");
      setNewLeadNotes("");
      executeAutoSync(true);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to save lead");
    }
  };

  const connectedCallsCount = useMemo(() => {
    return callLogs.filter((c) => (c.durationSec || 0) > 0).length;
  }, [callLogs]);

  const interestedCallsCount = useMemo(() => {
    return callLogs.filter((c) =>
      (c.dispositionLabel || "").toLowerCase().includes("interested") ||
      (c.dispositionLabel || "").toLowerCase().includes("deal"),
    ).length;
  }, [callLogs]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* Top App Header with Profile, Live Sync, Bell Icon */}
      <View style={styles.header}>
        <View style={styles.headerUserRow}>
          <View style={styles.userAvatarCircle}>
            <Text style={styles.userAvatarText}>AV</Text>
          </View>
          <View style={{ flex: 1, marginRight: 6 }}>
            <Text style={styles.headerGreeting} numberOfLines={1} ellipsizeMode="tail">Good Morning, Amit 👋</Text>
            <Text style={styles.headerRoleSubtitle} numberOfLines={1}>Telecaller • Solar Team</Text>
          </View>
        </View>

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={[styles.syncStatusChip, isSyncing && styles.syncStatusChipActive]}
            onPress={() => executeAutoSync(false)}
          >
            <View style={[styles.syncDot, isSyncing && styles.syncDotActive]} />
            <Text style={styles.syncStatusText}>{isSyncing ? "Syncing" : "Live"}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.headerIconBtn} onPress={() => setActiveTab("settings")}>
            <Bell size={18} color={THEME.text} strokeWidth={2} />
            <View style={styles.headerIconBadgeDot} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Permission Missing Warning Banner */}
      {setupStatus && (!setupStatus.callPhoneGranted || !setupStatus.readCallLogGranted) && (
        <TouchableOpacity
          style={styles.permissionActionBanner}
          onPress={() => Linking.openSettings()}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <AlertTriangle size={16} color={THEME.amberText} strokeWidth={2.5} />
            <Text style={styles.permissionActionTitle}>Phone Permissions Required: Tap to Grant</Text>
          </View>
          <Text style={styles.permissionActionSubtitle}>
            Enable Phone & Call Log access so calls dial directly and duration syncs automatically.
          </Text>
        </TouchableOpacity>
      )}

      {/* 72-Hour Offline Lease Grace Banner */}
      {syncMeta && (!syncMeta.isLeaseValid || (syncMeta.hoursSinceLastSync && syncMeta.hoursSinceLastSync >= 1)) && (
        <View style={[styles.offlineBanner, !syncMeta.isLeaseValid && styles.offlineBannerExpired]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
            <Database size={15} color={syncMeta.isLeaseValid ? THEME.amberText : THEME.redText} strokeWidth={2.5} />
            <Text style={[styles.offlineBannerTitle, !syncMeta.isLeaseValid && { color: THEME.redText }]}>
              {syncMeta.isLeaseValid
                ? `Offline Mode • ${pendingMutationsCount} updates queued for sync`
                : "Offline Lease Expired (>72h). Connect to network to resume calling."}
            </Text>
          </View>
          <TouchableOpacity style={styles.offlineSyncQuickBtn} onPress={() => executeAutoSync(false)}>
            <RefreshCw size={12} color={syncMeta.isLeaseValid ? THEME.amberText : THEME.redText} strokeWidth={2.5} />
            <Text style={[styles.offlineSyncQuickBtnText, !syncMeta.isLeaseValid && { color: THEME.redText }]}>Sync</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Tier-3 Unknown Call Dropped: Employee-controlled Add as Lead action (Section 1) */}
      {ignoredUnknownNumber && (
        <View style={styles.unknownCallBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.unknownCallBannerTitle}>📞 Non-CRM Call Dropped (Privacy Protected)</Text>
            <Text style={styles.unknownCallBannerSubtitle}>{ignoredUnknownNumber} is not an existing CRM lead.</Text>
          </View>
          <TouchableOpacity
            style={styles.unknownCallAddBtn}
            onPress={() => {
              setNewLeadPhone(ignoredUnknownNumber);
              setAddLeadModalVisible(true);
              setIgnoredUnknownNumber(null);
            }}
          >
            <Text style={styles.unknownCallAddBtnText}>Add as Lead</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setIgnoredUnknownNumber(null)} style={{ padding: 6 }}>
            <Text style={{ color: "#94A3B8", fontWeight: "bold" }}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* TAB 1: Home Dashboard */}
      {activeTab === "home" && (
        <ScrollView
          style={styles.contentScroll}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={Platform.OS === "android"}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onPullToRefresh}
              colors={[THEME.primary]}
              tintColor={THEME.primary}
            />
          }
        >
          {/* Today's Target Card */}
          <View style={styles.targetCard}>
            <View style={styles.targetCardTopRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.targetCardLabel}>Today's Target</Text>
                <Text style={styles.targetCardNumbers}>
                  {callLogs.length} <Text style={{ color: THEME.textMuted, fontSize: 18 }}>/ 30 Calls</Text>
                </Text>
                <View style={styles.streakBadgeSmall}>
                  <Flame size={12} color={THEME.amberText} strokeWidth={2.5} />
                  <Text style={styles.streakBadgeSmallText}>8-Day Streak Active</Text>
                </View>
              </View>

              <View style={styles.targetProgressCircleWrapper}>
                <View style={styles.targetProgressCircle}>
                  <Text style={styles.targetProgressPercentText}>
                    {Math.min(100, Math.round((callLogs.length / 30) * 100))}%
                  </Text>
                  <Text style={styles.targetProgressSubtext}>Target</Text>
                </View>
              </View>
            </View>

            <View style={styles.targetProgressBarTrack}>
              <View
                style={[
                  styles.targetProgressBarFill,
                  { width: `${Math.min(100, Math.round((callLogs.length / 30) * 100))}%` },
                ]}
              />
            </View>
          </View>

          {/* 4 Quick Stat Metric Badges with Plain Line Lucide Icons */}
          <View style={styles.statGrid}>
            <View style={styles.statBox}>
              <View style={[styles.statIconBadge, { backgroundColor: THEME.primaryLight }]}>
                <Users size={16} color={THEME.primary} strokeWidth={2} />
              </View>
              <Text style={styles.statNumber}>{leads.length}</Text>
              <Text style={styles.statTitle}>Total Leads</Text>
            </View>

            <View style={styles.statBox}>
              <View style={[styles.statIconBadge, { backgroundColor: THEME.greenLight }]}>
                <CheckCircle2 size={16} color={THEME.greenText} strokeWidth={2} />
              </View>
              <Text style={[styles.statNumber, { color: THEME.greenText }]}>{connectedCallsCount}</Text>
              <Text style={styles.statTitle}>Connected</Text>
            </View>

            <View style={styles.statBox}>
              <View style={[styles.statIconBadge, { backgroundColor: THEME.amberLight }]}>
                <Sparkles size={16} color={THEME.amberText} strokeWidth={2} />
              </View>
              <Text style={[styles.statNumber, { color: THEME.amberText }]}>{interestedCallsCount}</Text>
              <Text style={styles.statTitle}>Interested</Text>
            </View>

            <View style={styles.statBox}>
              <View style={[styles.statIconBadge, { backgroundColor: THEME.purpleLight }]}>
                <Calendar size={16} color={THEME.purpleText} strokeWidth={2} />
              </View>
              <Text style={[styles.statNumber, { color: THEME.purpleText }]}>
                {leads.filter((l) => l.stage.toLowerCase().includes("follow")).length || 6}
              </Text>
              <Text style={styles.statTitle}>Follow-ups</Text>
            </View>
          </View>

          {/* Next Up in Shift Queue Card */}
          {leads.length > 0 && (
            <View style={styles.nextLeadCard}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, flex: 1, marginRight: 6 }}>
                  <Zap size={14} color={THEME.primary} strokeWidth={2.5} />
                  <Text style={styles.nextLeadPretitle} numberOfLines={1}>NEXT CONTACT IN SHIFT QUEUE</Text>
                </View>
                <View style={styles.simPillSmall}>
                  <Text style={styles.simPillSmallText}>SIM {selectedSimSlot + 1}</Text>
                </View>
              </View>
              <Text style={styles.nextLeadName} numberOfLines={1} ellipsizeMode="tail">{leads[0].name}</Text>
              <Text style={styles.nextLeadCompany} numberOfLines={1} ellipsizeMode="tail">
                Commercial Rooftop • {formatPhone(leads[0].phoneE164)}
              </Text>

              {/* Mandatory DPDP / TRAI Recording Consent Disclosure Banner */}
              <View style={styles.consentBannerWrapper}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 3 }}>
                  <ShieldCheck size={13} color={THEME.amberText} strokeWidth={2.5} />
                  <Text style={styles.consentBannerTitle}>MANDATORY RECORDING DISCLOSURE</Text>
                </View>
                <Text style={styles.consentBannerScript}>
                  "Namaste {leads[0].name.split(' ')[0]} ji, this call is from SolarCRM and may be recorded for quality, documentation, and training purposes."
                </Text>
              </View>

              <View style={styles.nextLeadActionsRow}>
                <TouchableOpacity
                  style={styles.nextLeadDialBtn}
                  onPress={() => handleDial(leads[0])}
                >
                  <Phone size={14} color="#FFFFFF" strokeWidth={2.5} />
                  <Text style={styles.nextLeadDialBtnText} numberOfLines={1}>Call Now</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.nextLeadDialBtn, { backgroundColor: THEME.green, flex: 1.1 }]}
                  onPress={() => startAutoDialer()}
                >
                  <Zap size={14} color="#FFFFFF" strokeWidth={2.5} />
                  <Text style={styles.nextLeadDialBtnText} numberOfLines={1}>Auto-Dial</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.nextLeadQueueBtn}
                  onPress={() => setActiveTab("queue")}
                >
                  <Users size={14} color={THEME.primary} strokeWidth={2} />
                  <Text style={styles.nextLeadQueueBtnText} numberOfLines={1}>Queue ({leads.length})</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Today's Activity & Scheduled Follow-ups Timeline */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeading}>Today's Activity</Text>
            <TouchableOpacity
              style={{ flexDirection: "row", alignItems: "center", gap: 2 }}
              onPress={() => setActiveTab("history")}
            >
              <Text style={styles.sectionHeadingLink}>View All</Text>
              <ChevronRight size={14} color={THEME.primary} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          <View style={styles.activityTimelineCard}>
            <View style={styles.activityItem}>
              <View style={[styles.activityDot, { backgroundColor: THEME.green }]}>
                <Check size={10} color="#FFFFFF" strokeWidth={3} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.activityItemTitle}>Call: Hotel Ganga Residency</Text>
                <Text style={styles.activityItemTime}>10:30 AM • Follow-up Completed (02:34)</Text>
              </View>
              <View style={styles.activityBadgeSuccess}>
                <Text style={styles.activityBadgeSuccessText}>Done</Text>
              </View>
            </View>

            <View style={styles.activityDivider} />

            <View style={styles.activityItem}>
              <View style={[styles.activityDot, { backgroundColor: THEME.primary }]}>
                <Clock size={10} color="#FFFFFF" strokeWidth={3} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.activityItemTitle}>Follow-up: Shivam Palace</Text>
                <Text style={styles.activityItemTime}>04:00 PM • Rooftop Solar Proposal Discussion</Text>
              </View>
              <TouchableOpacity
                style={styles.activityActionBtn}
                onPress={() => {
                  const target = leads.find((l) => l.name.toLowerCase().includes("shivam")) || leads[0];
                  if (target) handleDial(target);
                }}
              >
                <Phone size={12} color={THEME.primary} strokeWidth={2.5} />
                <Text style={styles.activityActionBtnText}>Call</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.activityDivider} />

            <View style={styles.activityItem}>
              <View style={[styles.activityDot, { backgroundColor: THEME.amber }]}>
                <Calendar size={10} color="#FFFFFF" strokeWidth={3} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.activityItemTitle}>Callback: Kashi Grand Hotel</Text>
                <Text style={styles.activityItemTime}>11:15 AM • 50 kW Commercial Load Inquiry</Text>
              </View>
              <TouchableOpacity
                style={styles.activityActionBtn}
                onPress={() => {
                  const target = leads.find((l) => l.name.toLowerCase().includes("kashi")) || leads[0];
                  if (target) handleDial(target);
                }}
              >
                <Phone size={12} color={THEME.primary} strokeWidth={2.5} />
                <Text style={styles.activityActionBtnText}>Call</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ height: 110 }} />
        </ScrollView>
      )}

      {/* TAB 2: Leads Queue */}
      {activeTab === "queue" && (
        <ScrollView
          style={styles.contentScroll}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={Platform.OS === "android"}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onPullToRefresh}
              colors={[THEME.primary]}
              tintColor={THEME.primary}
            />
          }
        >
          {/* Header Action Bar */}
          <View style={styles.leadsHeaderRow}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.sectionHeading} numberOfLines={1}>My Leads ({filteredLeads.length})</Text>
              <Text style={styles.sectionSubtext} numberOfLines={1}>
                {leads.length} contacts assigned • Offline ready
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <TouchableOpacity
                style={[styles.addLeadBtn, { backgroundColor: THEME.green, paddingHorizontal: 12 }]}
                onPress={() => startAutoDialer()}
              >
                <Zap size={14} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={styles.addLeadBtnText}>Auto-Dial</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addLeadBtn} onPress={() => setAddLeadModalVisible(true)}>
                <Plus size={15} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={styles.addLeadBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Search Bar with Plain Lucide Search Icon */}
          <View style={styles.searchBarContainer}>
            <Search size={18} color={THEME.textMuted} strokeWidth={2} />
            <TextInput
              style={styles.searchBarInput}
              placeholder="Search leads by name, phone or company..."
              placeholderTextColor={THEME.textMuted}
              value={leadSearchQuery}
              onChangeText={setLeadSearchQuery}
            />
            {leadSearchQuery ? (
              <TouchableOpacity onPress={() => setLeadSearchQuery("")}>
                <X size={16} color={THEME.textMuted} strokeWidth={2} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Horizontal Filter Pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterPillsScroll}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}
          >
            {["all", "New Lead", "Follow-up", "In Progress", "Qualified"].map((st) => {
              const isSelected = leadStageFilter.toLowerCase() === st.toLowerCase();
              const count =
                st === "all"
                  ? leads.length
                  : leads.filter((l) => l.stage.toLowerCase() === st.toLowerCase()).length;
              return (
                <TouchableOpacity
                  key={st}
                  style={[styles.filterPill, isSelected && styles.filterPillActive]}
                  onPress={() => setLeadStageFilter(st)}
                >
                  <Text style={[styles.filterPillText, isSelected && styles.filterPillTextActive]}>
                    {st === "all" ? `All (${count})` : `${st} (${count})`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Missed Calls High Priority Banner */}
          {missedNotCalledBack.length > 0 && (
            <View style={styles.missedCard}>
              <View style={styles.missedCardHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <AlertTriangle size={18} color={THEME.amberText} strokeWidth={2.5} />
                  <Text style={styles.missedCardTitle}>
                    Missed, Not Called Back ({missedNotCalledBack.length})
                  </Text>
                </View>
                <View style={styles.urgencyTag}>
                  <Text style={styles.urgencyTagText}>High Urgency</Text>
                </View>
              </View>
              <Text style={styles.missedCardDesc}>
                Return calls promptly to maintain customer trust & conversion
              </Text>

              {missedNotCalledBack.map((missedCall) => {
                const displayName =
                  missedCall.leadName || (missedCall.numberE164 ? formatPhone(missedCall.numberE164) : "Contact");
                return (
                  <View key={missedCall.id} style={styles.missedItemRow}>
                    <View style={styles.missedAvatar}>
                      <Text style={styles.missedAvatarText}>{getInitials(displayName)}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.missedLeadName} numberOfLines={1} ellipsizeMode="tail">{displayName}</Text>
                      <Text style={styles.missedTime}>
                        Missed {formatDateTime(missedCall.startedAt)}
                      </Text>
                    </View>

                    <View style={styles.missedActionsGroup}>
                      <TouchableOpacity
                        style={styles.missedCallBackBtn}
                        onPress={() => {
                          const pseudoLead: CachedLead = {
                            id: missedCall.leadId || `missed_${missedCall.id}`,
                            name: displayName,
                            phoneE164: missedCall.numberE164,
                            stage: "Follow-up",
                            source: "Inbound Missed",
                            cachedAt: new Date().toISOString(),
                          };
                          handleDial(pseudoLead);
                        }}
                      >
                        <PhoneCall size={12} color="#FFFFFF" strokeWidth={2.5} />
                        <Text style={styles.missedCallBackBtnText}>Call Back</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.missedMiniAction}
                        onPress={() => handleOpenWhatsApp(missedCall.numberE164, displayName)}
                      >
                        <MessageCircle size={15} color={THEME.greenText} strokeWidth={2} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.missedDismissBtn}
                        onPress={() => {
                          setDismissedMissedIds((prev) => new Set([...prev, missedCall.id]));
                        }}
                      >
                        <X size={13} color={THEME.textMuted} strokeWidth={2.5} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Lead Cards List */}
          {filteredLeads.map((lead) => (
            <TouchableOpacity
              key={lead.id}
              style={styles.leadCard}
              activeOpacity={0.9}
              onPress={() => {
                setSelectedLeadDetails(lead);
                setLeadDetailsModalVisible(true);
              }}
            >
              <View style={styles.leadCardTop}>
                <View style={styles.leadBuildingBox}>
                  <Building2 size={20} color={THEME.primary} strokeWidth={1.8} />
                </View>

                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={styles.leadName} numberOfLines={1} ellipsizeMode="tail">{lead.name}</Text>
                    <View
                      style={[
                        styles.stageBadge,
                        lead.stage.toLowerCase().includes("new")
                          ? styles.stageBadgeNew
                          : lead.stage.toLowerCase().includes("follow")
                          ? styles.stageBadgeFollow
                          : styles.stageBadgeQualified,
                      ]}
                    >
                      <Text
                        style={[
                          styles.stageBadgeText,
                          lead.stage.toLowerCase().includes("new")
                            ? styles.stageBadgeTextNew
                            : lead.stage.toLowerCase().includes("follow")
                            ? styles.stageBadgeTextFollow
                            : styles.stageBadgeTextQualified,
                        ]}
                        numberOfLines={1}
                      >
                        {lead.stage}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.leadSubtitle} numberOfLines={1} ellipsizeMode="tail">
                    Commercial Rooftop • {formatPhone(lead.phoneE164)}
                  </Text>
                </View>
              </View>

              {lead.notes ? (
                <View style={styles.leadNotesPreviewBox}>
                  <FileText size={12} color={THEME.textSecondary} strokeWidth={2} />
                  <Text style={styles.leadNotesPreviewText} numberOfLines={1} ellipsizeMode="tail">
                    {lead.notes}
                  </Text>
                </View>
              ) : null}

              {/* Quick Action Chips */}
              <View style={styles.leadChipsRow}>
                <TouchableOpacity
                  style={styles.microChip}
                  onPress={() => openLeadActionModal(lead, "reminder")}
                >
                  <Clock size={11} color={THEME.amberText} strokeWidth={2} />
                  <Text style={styles.microChipText}>Reminder</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.microChip}
                  onPress={() => openLeadActionModal(lead, "note")}
                >
                  <FileText size={11} color={THEME.primary} strokeWidth={2} />
                  <Text style={styles.microChipText}>Add Note</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.microChip}
                  onPress={() => openLeadActionModal(lead, "stage")}
                >
                  <CheckCircle2 size={11} color={THEME.greenText} strokeWidth={2} />
                  <Text style={styles.microChipText}>Stage</Text>
                </TouchableOpacity>
              </View>

              {/* Micro-actions Row */}
              <View style={styles.leadActionsRow}>
                <TouchableOpacity
                  style={styles.leadDialBtn}
                  onPress={() => handleDial(lead)}
                >
                  <Phone size={13} color="#FFFFFF" strokeWidth={2.5} />
                  <Text style={styles.leadDialBtnText} numberOfLines={1}>Call Now</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.leadWhatsAppBtn}
                  onPress={() => handleOpenWhatsApp(lead.phoneE164, lead.name)}
                >
                  <MessageCircle size={13} color={THEME.greenText} strokeWidth={2} />
                  <Text style={styles.leadWhatsAppBtnText} numberOfLines={1}>WhatsApp</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.leadSmsBtn}
                  onPress={() => handleOpenSMS(lead.phoneE164, lead.name)}
                >
                  <MessageSquare size={13} color={THEME.primary} strokeWidth={2} />
                  <Text style={styles.leadSmsBtnText} numberOfLines={1}>SMS</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}

          <View style={{ height: 110 }} />
        </ScrollView>
      )}

      {/* TAB 3: Reports & Performance */}
      {activeTab === "reports" && (
        <ScrollView
          style={styles.contentScroll}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={Platform.OS === "android"}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onPullToRefresh}
              colors={[THEME.primary]}
              tintColor={THEME.primary}
            />
          }
        >
          {/* Segmented Controller: Team Performance vs Lead Pipeline Funnel */}
          <View style={styles.segmentContainer}>
            <TouchableOpacity
              style={[styles.segmentBtn, reportsSubTab === "team" && styles.segmentBtnActive]}
              onPress={() => setReportsSubTab("team")}
            >
              <Users size={14} color={reportsSubTab === "team" ? THEME.primary : THEME.textSecondary} strokeWidth={2} />
              <Text style={[styles.segmentBtnText, reportsSubTab === "team" && styles.segmentBtnTextActive]}>
                Team Performance
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.segmentBtn, reportsSubTab === "funnel" && styles.segmentBtnActive]}
              onPress={() => setReportsSubTab("funnel")}
            >
              <BarChart2 size={14} color={reportsSubTab === "funnel" ? THEME.primary : THEME.textSecondary} strokeWidth={2} />
              <Text style={[styles.segmentBtnText, reportsSubTab === "funnel" && styles.segmentBtnTextActive]}>
                Lead Pipeline Funnel
              </Text>
            </TouchableOpacity>
          </View>

          {reportsSubTab === "team" ? (
            <>
              {/* Calls Made This Week Card with Bar Chart */}
              <View style={styles.performanceHeroCard}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View>
                    <Text style={styles.heroCardLabel}>Calls Made This Week</Text>
                    <Text style={styles.heroCardNumber}>268</Text>
                  </View>
                  <View style={styles.trendPill}>
                    <TrendingUp size={12} color={THEME.greenText} strokeWidth={2.5} />
                    <Text style={styles.trendPillText}>+18% vs Last Week</Text>
                  </View>
                </View>

                {/* Minimalist Bar Chart */}
                <View style={styles.chartBarRow}>
                  {[
                    { day: "Mon", height: 48 },
                    { day: "Tue", height: 62 },
                    { day: "Wed", height: 54 },
                    { day: "Thu", height: 75 },
                    { day: "Fri", height: 85 },
                    { day: "Sat", height: 68 },
                    { day: "Sun", height: 28 },
                  ].map((bar) => (
                    <View key={bar.day} style={styles.chartBarCol}>
                      <View style={[styles.chartBarPill, { height: bar.height }]} />
                      <Text style={styles.chartDayText}>{bar.day}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* 4 Summary Badges */}
              <View style={styles.statGrid}>
                <View style={styles.statBox}>
                  <Text style={[styles.statNumber, { color: THEME.greenText }]}>96</Text>
                  <Text style={styles.statTitle}>Connected (36%)</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statNumber, { color: THEME.amberText }]}>28</Text>
                  <Text style={styles.statTitle}>Interested (10%)</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statNumber, { color: THEME.purpleText }]}>34</Text>
                  <Text style={styles.statTitle}>Follow-ups</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statNumber, { color: THEME.primary }]}>6</Text>
                  <Text style={styles.statTitle}>Won / Closed</Text>
                </View>
              </View>

              {/* Telecaller Leaderboard Card */}
              <View style={styles.leaderboardCard}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}>
                  <Users size={18} color={THEME.text} strokeWidth={2} />
                  <Text style={styles.sectionHeading}>Telecaller Leaderboard</Text>
                </View>

                {[
                  { rank: 1, name: "Amit Verma (You)", calls: 42, connected: 12, rate: "72%" },
                  { rank: 2, name: "Priya Sharma", calls: 46, connected: 20, rate: "78%" },
                  { rank: 3, name: "Ankit Kumar", calls: 38, connected: 15, rate: "62%" },
                  { rank: 4, name: "Suresh Patil", calls: 31, connected: 11, rate: "58%" },
                ].map((item) => (
                  <View key={item.rank} style={styles.leaderRow}>
                    <View style={styles.rankBadge}>
                      <Text style={styles.rankBadgeText}>{item.rank}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.leaderName}>{item.name}</Text>
                      <Text style={styles.leaderCalls}>
                        {item.calls} Calls • {item.connected} Connected
                      </Text>
                    </View>
                    <View style={styles.ratePill}>
                      <Text style={styles.ratePillText}>{item.rate}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          ) : (
            /* Funnel Pipeline Breakdown */
            <View style={styles.pipelineCard}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 14 }}>
                <BarChart2 size={18} color={THEME.text} strokeWidth={2} />
                <Text style={styles.sectionHeading}>Lead Conversion Pipeline</Text>
              </View>

              {[
                { stage: "New Assigned Leads", count: 142, pct: "100%", color: THEME.primary },
                { stage: "Contacted / In Call", count: 56, pct: "39%", color: "#3B82F6" },
                { stage: "Follow-up Scheduled", count: 34, pct: "24%", color: THEME.amberText },
                { stage: "Proposal & Site Visit", count: 18, pct: "12%", color: THEME.purpleText },
                { stage: "Deals Won / Closed", count: 6, pct: "4%", color: THEME.greenText },
              ].map((step, idx) => (
                <View key={step.stage} style={styles.pipelineStepRow}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                    <Text style={styles.pipelineStepName}>{step.stage}</Text>
                    <Text style={styles.pipelineStepCount}>
                      {step.count} leads ({step.pct})
                    </Text>
                  </View>
                  <View style={styles.pipelineTrack}>
                    <View
                      style={[
                        styles.pipelineFill,
                        { width: step.pct as any, backgroundColor: step.color },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
          )}

          <View style={{ height: 110 }} />
        </ScrollView>
      )}

      {/* TAB 4: More / Settings */}
      {activeTab === "settings" && (
        <ScrollView
          style={styles.contentScroll}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={Platform.OS === "android"}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onPullToRefresh}
              colors={[THEME.primary]}
              tintColor={THEME.primary}
            />
          }
        >
          {/* Profile Card */}
          <View style={styles.profileCard}>
            <View style={styles.profileAvatarLarge}>
              <Text style={styles.profileAvatarLargeText}>AV</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={styles.profileName}>Amit Verma</Text>
              <Text style={styles.profileSub}>Telecaller • +91 98765 11223</Text>
              <Text style={styles.profileRoleBadge}>caller1@telecalling.crm</Text>
            </View>
          </View>

          {/* Universal Android Hardware Calibration Card */}
          <TouchableOpacity
            style={styles.calibrationBannerCard}
            onPress={() => setSetupWizardVisible(true)}
            activeOpacity={0.85}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, marginRight: 8 }}>
                <View style={styles.calibrationIconBadge}>
                  <ShieldCheck size={20} color={THEME.primary} strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.calibrationCardTitle} numberOfLines={1}>Hardware Calibration Wizard</Text>
                  <Text style={styles.calibrationCardSub} numberOfLines={1}>Realme RMX3869 • All 7 Steps Verified</Text>
                </View>
              </View>
              <ChevronRight size={18} color={THEME.textSecondary} strokeWidth={2} />
            </View>
          </TouchableOpacity>

          {/* Telephony Dialing Mode */}
          <View style={styles.settingsGroupCard}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <PhoneCall size={16} color={isSimulationMode ? THEME.amberText : THEME.greenText} strokeWidth={2.2} />
                <Text style={styles.settingsGroupTitle}>Telephony Dialing Mode</Text>
              </View>
              <View style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 12,
                backgroundColor: isSimulationMode ? THEME.amberLight : THEME.greenLight,
              }}>
                <Text style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: isSimulationMode ? THEME.amberText : THEME.greenText,
                }}>
                  {isSimulationMode ? "Simulation Mode" : "Live Carrier (Active)"}
                </Text>
              </View>
            </View>
            <Text style={styles.settingsGroupDesc}>
              {isSimulationMode
                ? "Safe Testing: Dials are simulated locally with realistic durations (zero real phone calls)."
                : "Production Mode: Real cellular phone calls will be placed using SIM card airtime."}
            </Text>
            <View style={styles.simSlotsRow}>
              <TouchableOpacity
                style={[styles.simSlotPill, !isSimulationMode && styles.simSlotPillActive]}
                onPress={() => handleToggleSimulationMode(false)}
              >
                <Text style={[styles.simSlotPillText, !isSimulationMode && styles.simSlotPillTextActive]}>
                  📞 Live Carrier Calls
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.simSlotPill, isSimulationMode && styles.simSlotPillActive]}
                onPress={() => handleToggleSimulationMode(true)}
              >
                <Text style={[styles.simSlotPillText, isSimulationMode && styles.simSlotPillTextActive]}>
                  🧪 Simulation Mode
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* SIM Selector */}
          <View style={styles.settingsGroupCard}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Smartphone size={16} color={THEME.primary} strokeWidth={2} />
              <Text style={styles.settingsGroupTitle}>Outbound SIM Card</Text>
            </View>
            <Text style={styles.settingsGroupDesc}>
              Select default carrier slot for outgoing phone calls:
            </Text>
            <View style={styles.simSlotsRow}>
              {[
                { slot: 0, label: "SIM 1 (Airtel / Slot 1)" },
                { slot: 1, label: "SIM 2 (Jio / Slot 2)" },
              ].map((s) => (
                <TouchableOpacity
                  key={s.slot}
                  style={[styles.simSlotPill, selectedSimSlot === s.slot && styles.simSlotPillActive]}
                  onPress={() => setSelectedSimSlot(s.slot)}
                >
                  <Text
                    style={[
                      styles.simSlotPillText,
                      selectedSimSlot === s.slot && styles.simSlotPillTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Work SIM Policy (Privacy First) */}
          <View style={styles.settingsGroupCard}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <ShieldCheck size={16} color={THEME.primary} strokeWidth={2} />
              <Text style={styles.settingsGroupTitle}>Work SIM Privacy Policy</Text>
            </View>
            <Text style={styles.settingsGroupDesc}>
              Restricts automatic call logging to your enterprise SIM slot. Personal SIM calls are strictly ignored:
            </Text>
            <View style={{ gap: 8 }}>
              <TouchableOpacity
                style={[styles.simSlotPill, workSimSlot === "-1" && styles.simSlotPillActive]}
                onPress={async () => {
                  setWorkSimSlot("-1");
                  await TelephonyEngine.setConfig({ work_sim_slot: "-1" });
                  await sqliteStore.updateSyncMeta("cfg_work_sim_slot", "-1");
                  Alert.alert(
                    "Work SIM Policy Updated",
                    "Calls on all SIM cards matching CRM leads will be tracked."
                  );
                }}
              >
                <Text
                  style={[
                    styles.simSlotPillText,
                    workSimSlot === "-1" && styles.simSlotPillTextActive,
                  ]}
                  numberOfLines={1}
                >
                  Dual SIM (All Business Calls)
                </Text>
              </TouchableOpacity>

              <View style={{ flexDirection: "row", gap: 8 }}>
                {[
                  { slot: "0", label: "SIM 1 (Work Only)" },
                  { slot: "1", label: "SIM 2 (Work Only)" },
                ].map((ws) => (
                  <TouchableOpacity
                    key={ws.slot}
                    style={[styles.simSlotPill, workSimSlot === ws.slot && styles.simSlotPillActive]}
                    onPress={async () => {
                      setWorkSimSlot(ws.slot);
                      await TelephonyEngine.setConfig({ work_sim_slot: ws.slot });
                      await sqliteStore.updateSyncMeta("cfg_work_sim_slot", ws.slot);
                      Alert.alert(
                        "Work SIM Policy Updated",
                        `Only calls placed or received on SIM ${parseInt(ws.slot, 10) + 1} will be logged. Other SIM calls are ignored.`
                      );
                    }}
                  >
                    <Text
                      style={[
                        styles.simSlotPillText,
                        workSimSlot === ws.slot && styles.simSlotPillTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {ws.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Telephony Engine & Health Checks */}
          <View style={styles.settingsGroupCard}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <Headphones size={16} color={THEME.primary} strokeWidth={2} />
              <Text style={styles.settingsGroupTitle}>Telephony Engine & Permissions</Text>
            </View>
            <View style={styles.healthRow}>
              <Text style={styles.healthLabel}>Phone Calls:</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <CheckCircle2 size={14} color={THEME.greenText} strokeWidth={2.5} />
                <Text style={[styles.healthVal, { color: THEME.greenText }]}>Granted</Text>
              </View>
            </View>
            <View style={styles.healthRow}>
              <Text style={styles.healthLabel}>Call Log Access:</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <CheckCircle2 size={14} color={THEME.greenText} strokeWidth={2.5} />
                <Text style={[styles.healthVal, { color: THEME.greenText }]}>Granted</Text>
              </View>
            </View>
            <View style={styles.healthRow}>
              <Text style={styles.healthLabel}>Battery Optimization:</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <AlertTriangle size={14} color={THEME.amberText} strokeWidth={2.5} />
                <Text style={[styles.healthVal, { color: THEME.amberText }]}>Battery Saver</Text>
              </View>
            </View>
            <View style={styles.healthRow}>
              <Text style={styles.healthLabel}>Offline Readiness:</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Database size={14} color={THEME.greenText} strokeWidth={2} />
                <Text style={[styles.healthVal, { color: THEME.greenText }]}>Ready ({leads.length} Leads Cached)</Text>
              </View>
            </View>
          </View>

          {/* Cloud Synchronization (Clean Customer & Telecaller Perspective) */}
          <View style={styles.settingsGroupCard}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Cloud size={16} color={THEME.primary} strokeWidth={2.2} />
                <Text style={styles.settingsGroupTitle}>Cloud Synchronization</Text>
              </View>
              <View style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 12,
                backgroundColor: THEME.greenLight,
              }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: THEME.greenText }} />
                <Text style={{ fontSize: 11, fontWeight: "700", color: THEME.greenText }}>
                  {isSyncing ? "Syncing..." : "Connected"}
                </Text>
              </View>
            </View>

            <Text style={styles.settingsGroupDesc}>
              Automatically syncs leads, caller activities, and call outcomes with SolarCRM Cloud.
            </Text>

            <TouchableOpacity
              style={styles.syncFullBtn}
              onPress={() => executeAutoSync(false)}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <RefreshCw size={15} color="#FFFFFF" strokeWidth={2.5} />
                  <Text style={styles.syncFullBtnText}>Sync CRM Database Now</Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
              <Text style={styles.lastSyncInfo}>
                Last synchronized: {lastSyncTime || "Just now"}
              </Text>
              <Text style={{ fontSize: 11, color: THEME.textMuted }}>
                {leads.length} leads ready
              </Text>
            </View>
          </View>

          {/* Enterprise Gateway Settings (Collapsible for standard users) */}
          <View style={{ marginTop: 6, marginBottom: 10 }}>
            <TouchableOpacity
              onPress={() => setShowDevSettings(!showDevSettings)}
              style={{ paddingVertical: 10, alignItems: "center" }}
            >
              <Text style={{ fontSize: 12, color: THEME.textMuted, fontWeight: "600" }}>
                {showDevSettings ? "▲ Hide Connection Settings" : "⚙️ Enterprise Gateway Connection"}
              </Text>
            </TouchableOpacity>

            {showDevSettings && (
              <View style={[styles.settingsGroupCard, { marginTop: 4 }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <Cloud size={16} color={THEME.primary} strokeWidth={2} />
                  <Text style={[styles.settingsGroupTitle, { fontSize: 13 }]}>CRM Server Gateway</Text>
                </View>
                <TextInput
                  style={styles.serverInput}
                  value={serverUrl}
                  onChangeText={setServerUrl}
                  placeholder="https://api.solarcrm.com"
                  placeholderTextColor={THEME.textMuted}
                  autoCapitalize="none"
                />
                <View style={styles.chipRow}>
                  <TouchableOpacity
                    style={styles.quickChip}
                    onPress={() => setServerUrl("https://api.solarcrm.com")}
                  >
                    <Text style={styles.quickChipText}>Production Cloud</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quickChip}
                    onPress={() => setServerUrl("http://localhost:4000/api")}
                  >
                    <Text style={styles.quickChipText}>Local Gateway</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          <View style={{ height: 110 }} />
        </ScrollView>
      )}

      {/* TAB 5: Recents / Call History */}
      {activeTab === "history" && (
        <ScrollView
          style={styles.contentScroll}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={Platform.OS === "android"}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onPullToRefresh}
              colors={[THEME.primary]}
              tintColor={THEME.primary}
            />
          }
        >
          <View style={styles.leadsHeaderRow}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.sectionHeading} numberOfLines={1}>Recent Call Logs ({callLogs.length})</Text>
              <Text style={styles.sectionSubtext} numberOfLines={1}>Dials, duration, and disposition audits</Text>
            </View>
            <TouchableOpacity style={styles.addLeadBtn} onPress={() => refreshCallLogs()}>
              <RefreshCw size={14} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.addLeadBtnText}>Refresh</Text>
            </TouchableOpacity>
          </View>

          {callLogs.map((call) => {
            const displayName = call.leadName || (call.numberE164 ? formatPhone(call.numberE164) : "Contact");
            const isConnected = (call.durationSec || 0) > 0;
            return (
              <View key={call.id || call.startedAt} style={styles.historyCard}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={styles.leadBuildingBox}>
                    <Building2 size={18} color={THEME.primary} strokeWidth={1.8} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10, marginRight: 8 }}>
                    <Text style={styles.historyName} numberOfLines={1} ellipsizeMode="tail">{displayName}</Text>
                    <Text style={styles.historyTime} numberOfLines={1}>{formatDateTime(call.startedAt)}</Text>
                  </View>
                  <View
                    style={[
                      styles.outcomePill,
                      isConnected ? styles.outcomePillConnected : styles.outcomePillMissed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.outcomePillText,
                        isConnected ? styles.outcomePillTextConnected : styles.outcomePillTextMissed,
                      ]}
                      numberOfLines={1}
                    >
                      {isConnected ? `Connected (${formatDuration(call.durationSec)})` : "Missed"}
                    </Text>
                  </View>
                </View>

                {call.dispositionLabel ? (
                  <View style={styles.historyDispRow}>
                    <CheckCircle2 size={12} color={THEME.primary} strokeWidth={2} />
                    <Text style={styles.historyDispText} numberOfLines={1}>{call.dispositionLabel}</Text>
                    {call.remark ? (
                      <Text style={styles.historyRemarkText} numberOfLines={1} ellipsizeMode="tail"> • "{call.remark}"</Text>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })}
          <View style={{ height: 110 }} />
        </ScrollView>
      )}

      {/* Floating Bottom Navigation Bar with Plain Line Lucide Icons & Center Plus Add Lead FAB */}
      <View style={styles.bottomNavContainer}>
        <TouchableOpacity
          style={styles.bottomNavItem}
          onPress={() => setActiveTab("home")}
        >
          <LayoutGrid
            size={22}
            color={activeTab === "home" ? THEME.primary : THEME.textMuted}
            strokeWidth={activeTab === "home" ? 2.5 : 1.8}
          />
          <Text style={[styles.bottomNavText, activeTab === "home" && styles.bottomNavTextActive]} numberOfLines={1}>
            Home
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomNavItem}
          onPress={() => setActiveTab("queue")}
        >
          <Users
            size={22}
            color={activeTab === "queue" ? THEME.primary : THEME.textMuted}
            strokeWidth={activeTab === "queue" ? 2.5 : 1.8}
          />
          <Text style={[styles.bottomNavText, activeTab === "queue" && styles.bottomNavTextActive]} numberOfLines={1}>
            Leads
          </Text>
        </TouchableOpacity>

        {/* Center Elevated Action FAB [ + ] */}
        <View style={styles.fabWrapper}>
          <TouchableOpacity
            style={styles.centerFab}
            activeOpacity={0.88}
            accessibilityLabel="Add New Lead"
            onPress={() => {
              setAddLeadModalVisible(true);
            }}
          >
            <Plus size={28} color="#FFFFFF" strokeWidth={2.6} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.bottomNavItem}
          onPress={() => setActiveTab("reports")}
        >
          <BarChart2
            size={22}
            color={activeTab === "reports" ? THEME.primary : THEME.textMuted}
            strokeWidth={activeTab === "reports" ? 2.5 : 1.8}
          />
          <Text style={[styles.bottomNavText, activeTab === "reports" && styles.bottomNavTextActive]} numberOfLines={1}>
            Reports
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomNavItem}
          onPress={() => setActiveTab("settings")}
        >
          <Settings
            size={22}
            color={activeTab === "settings" ? THEME.primary : THEME.textMuted}
            strokeWidth={activeTab === "settings" ? 2.5 : 1.8}
          />
          <Text style={[styles.bottomNavText, activeTab === "settings" && styles.bottomNavTextActive]} numberOfLines={1}>
            More
          </Text>
        </TouchableOpacity>
      </View>

      {/* MODAL 1: Lead Details Modal */}
      <Modal
        visible={leadDetailsModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setLeadDetailsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.detailsModalContent}>
            <View style={styles.detailsHeader}>
              <TouchableOpacity
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                onPress={() => setLeadDetailsModalVisible(false)}
              >
                <ChevronLeft size={20} color={THEME.text} strokeWidth={2.5} />
                <Text style={styles.detailsBackText}>Back</Text>
              </TouchableOpacity>
              <Text style={styles.detailsTitle}>Lead Details</Text>
              <TouchableOpacity onPress={() => setLeadDetailsModalVisible(false)}>
                <Pencil size={18} color={THEME.primary} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {selectedLeadDetails && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Contact Card in Details */}
                <View style={styles.detailsLeadHeaderCard}>
                  <View style={styles.detailsAvatarCircle}>
                    <Building2 size={26} color={THEME.primary} strokeWidth={1.8} />
                  </View>
                  <Text style={styles.detailsLeadName}>{selectedLeadDetails.name}</Text>
                  <Text style={styles.detailsLeadCompany}>
                    Commercial Rooftop • Varanasi
                  </Text>
                  <View style={styles.stageBadgeNew}>
                    <Text style={styles.stageBadgeTextNew}>{selectedLeadDetails.stage}</Text>
                  </View>

                  {/* Mandatory DPDP / TRAI Recording Consent Disclosure Script */}
                  <View style={styles.consentBannerDetails}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 3 }}>
                      <ShieldCheck size={12} color={THEME.amberText} strokeWidth={2.5} />
                      <Text style={styles.consentBannerTitle}>MANDATORY RECORDING DISCLOSURE</Text>
                    </View>
                    <Text style={styles.consentBannerScript}>
                      "Namaste {selectedLeadDetails.name.split(' ')[0]} ji, this call is from SolarCRM and may be recorded for quality, documentation, and training purposes."
                    </Text>
                  </View>

                  {/* 3 Quick Action Buttons in Modal */}
                  <View style={styles.detailsActionButtonsRow}>
                    <TouchableOpacity
                      style={styles.detailsActionDialBtn}
                      onPress={() => {
                        setLeadDetailsModalVisible(false);
                        handleDial(selectedLeadDetails);
                      }}
                    >
                      <Phone size={15} color="#FFFFFF" strokeWidth={2.5} />
                      <Text style={styles.detailsActionDialBtnText}>Call</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.detailsActionWhatsAppBtn}
                      onPress={() =>
                        handleOpenWhatsApp(selectedLeadDetails.phoneE164, selectedLeadDetails.name)
                      }
                    >
                      <MessageCircle size={15} color={THEME.greenText} strokeWidth={2} />
                      <Text style={styles.detailsActionWhatsAppBtnText}>WhatsApp</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.detailsActionMeetingBtn}
                      onPress={() => {
                        setLeadDetailsModalVisible(false);
                        openLeadActionModal(selectedLeadDetails, "reminder");
                      }}
                    >
                      <Calendar size={15} color={THEME.purpleText} strokeWidth={2} />
                      <Text style={styles.detailsActionMeetingBtnText}>Callback</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Segmented Details vs Notes Tabs */}
                <View style={styles.detailsTabsRow}>
                  <TouchableOpacity
                    style={[styles.detailsTab, leadDetailsTab === "details" && styles.detailsTabActive]}
                    onPress={() => setLeadDetailsTab("details")}
                  >
                    <Text
                      style={[
                        styles.detailsTabText,
                        leadDetailsTab === "details" && styles.detailsTabTextActive,
                      ]}
                    >
                      Details
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.detailsTab, leadDetailsTab === "notes" && styles.detailsTabActive]}
                    onPress={() => setLeadDetailsTab("notes")}
                  >
                    <Text
                      style={[
                        styles.detailsTabText,
                        leadDetailsTab === "notes" && styles.detailsTabTextActive,
                      ]}
                    >
                      Notes
                    </Text>
                  </TouchableOpacity>
                </View>

                {leadDetailsTab === "details" ? (
                  <View style={styles.detailsAttributesCard}>
                    <View style={styles.attrRow}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <User size={15} color={THEME.textSecondary} strokeWidth={2} />
                        <Text style={styles.attrLabel}>Contact Person:</Text>
                      </View>
                      <Text style={styles.attrVal}>{selectedLeadDetails.name}</Text>
                    </View>
                    <View style={styles.attrDivider} />
                    <View style={styles.attrRow}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Phone size={15} color={THEME.textSecondary} strokeWidth={2} />
                        <Text style={styles.attrLabel}>Phone Number:</Text>
                      </View>
                      <Text style={styles.attrVal}>{formatPhone(selectedLeadDetails.phoneE164)}</Text>
                    </View>
                    <View style={styles.attrDivider} />
                    <View style={styles.attrRow}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <MapPin size={15} color={THEME.textSecondary} strokeWidth={2} />
                        <Text style={styles.attrLabel}>Location / City:</Text>
                      </View>
                      <Text style={styles.attrVal}>Varanasi, UP</Text>
                    </View>
                    <View style={styles.attrDivider} />
                    <View style={styles.attrRow}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Zap size={15} color={THEME.textSecondary} strokeWidth={2} />
                        <Text style={styles.attrLabel}>Estimated Load:</Text>
                      </View>
                      <Text style={styles.attrVal}>50 kW Commercial Rooftop</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.detailsAttributesCard}>
                    <Text style={styles.attrLabel}>Discussion Notes:</Text>
                    <Text style={styles.notesBodyText}>
                      {selectedLeadDetails.notes || "No notes recorded yet. Add remarks or call updates."}
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL 2: Call Disposition Modal with "Save & Next ➔" */}
      <Modal
        visible={dispositionModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDispositionModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.dispositionModalSheet}>
            {/* Header with Call Duration Badge */}
            <View style={styles.dispModalHeader}>
              <View>
                <Text style={styles.dispLeadName}>{activeLead?.name || "Active Call"}</Text>
                <Text style={styles.dispLeadPhone}>
                  {activeLead ? formatPhone(activeLead.phoneE164) : ""}
                </Text>
              </View>
              <View style={styles.dispDurationBadge}>
                <Clock size={12} color={THEME.greenText} strokeWidth={2.5} />
                <Text style={styles.dispDurationBadgeText}>02:34</Text>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Call Outcome Chips */}
              <Text style={styles.fieldLabel}>Call Outcome *</Text>
              <View style={styles.outcomeChipsRow}>
                {[
                  { key: "connected", label: "Connected" },
                  { key: "not_picked", label: "Not Picked" },
                  { key: "busy", label: "Busy" },
                  { key: "switched_off", label: "Switched Off" },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.key}
                    style={[
                      styles.outcomeChip,
                      callOutcome === item.key && styles.outcomeChipActive,
                    ]}
                    onPress={() => setCallOutcome(item.key as any)}
                  >
                    {callOutcome === item.key ? (
                      <Check size={12} color={THEME.primary} strokeWidth={3} />
                    ) : null}
                    <Text
                      style={[
                        styles.outcomeChipText,
                        callOutcome === item.key && styles.outcomeChipTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Disposition Selector */}
              <Text style={styles.fieldLabel}>Business Disposition *</Text>
              <View style={styles.dispositionPillsRow}>
                {dispositionsList.map((disp) => (
                  <TouchableOpacity
                    key={disp.id}
                    style={[
                      styles.dispPill,
                      selectedDisposition === disp.label && styles.dispPillActive,
                    ]}
                    onPress={() => setSelectedDisposition(disp.label)}
                  >
                    <Text
                      style={[
                        styles.dispPillText,
                        selectedDisposition === disp.label && styles.dispPillTextActive,
                      ]}
                    >
                      {disp.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Follow-up Timing */}
              <Text style={styles.fieldLabel}>Next Follow-up Timing</Text>
              <View style={styles.followupChipsRow}>
                {[
                  { days: 1, label: "Tomorrow" },
                  { days: 3, label: "3 Days" },
                  { days: 7, label: "Next Week" },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.days}
                    style={[
                      styles.followupChip,
                      followUpDays === item.days && styles.followupChipActive,
                    ]}
                    onPress={() => {
                      setFollowUpDays(item.days);
                      setQuickCallbackMinutes(null);
                    }}
                  >
                    <Calendar size={13} color={followUpDays === item.days ? THEME.primary : THEME.textSecondary} strokeWidth={2} />
                    <Text
                      style={[
                        styles.followupChipText,
                        followUpDays === item.days && styles.followupChipTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Remarks */}
              <Text style={styles.fieldLabel}>Call Notes / Remarks</Text>
              <TextInput
                style={styles.remarksInput}
                placeholder="Discussed 50 kW rooftop solar project. Send quote on WhatsApp..."
                placeholderTextColor={THEME.textMuted}
                value={callRemark}
                onChangeText={setCallRemark}
                multiline
              />

              {/* WhatsApp Checkbox */}
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setSendWhatsAppAfterSave(!sendWhatsAppAfterSave)}
              >
                <View style={[styles.checkboxBox, sendWhatsAppAfterSave && styles.checkboxBoxChecked]}>
                  {sendWhatsAppAfterSave && <Check size={11} color="#FFFFFF" strokeWidth={3} />}
                </View>
                <Text style={styles.checkboxLabel}>Send WhatsApp follow-up template after saving</Text>
              </TouchableOpacity>

              {/* DPDP Consent Confirmation */}
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setVerbalConsentGiven(!verbalConsentGiven)}
              >
                <View style={[styles.checkboxBox, verbalConsentGiven && styles.checkboxBoxChecked]}>
                  {verbalConsentGiven && <Check size={11} color="#FFFFFF" strokeWidth={3} />}
                </View>
                <Text style={styles.checkboxLabel}>Verbal recording disclosure delivered to customer</Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Bottom Actions with "Save & Next ➔" */}
            <View style={styles.saveBtnsRow}>
              <TouchableOpacity
                style={styles.saveOnlyBtn}
                onPress={() => handleSaveDisposition(false)}
              >
                <Text style={styles.saveOnlyBtnText}>Save</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveAndNextBtn}
                onPress={() => handleSaveDisposition(true)}
              >
                <Text style={styles.saveAndNextBtnText}>Save & Next</Text>
                <ArrowRight size={16} color="#FFFFFF" strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 3: Lead Action Quick Modal (Note / Reminder / Stage) */}
      <Modal
        visible={leadActionModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setLeadActionModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.actionModalSheet}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={styles.sectionHeading}>
                {actionModalType === "note"
                  ? "Update Lead Note"
                  : actionModalType === "reminder"
                  ? "Set Quick Callback"
                  : "Change Pipeline Stage"}
              </Text>
              <TouchableOpacity onPress={() => setLeadActionModalVisible(false)}>
                <X size={18} color={THEME.textMuted} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {actionModalType === "note" && (
              <View style={{ marginTop: 14 }}>
                <TextInput
                  style={styles.remarksInput}
                  placeholder="Enter key lead preferences, project scope, budget..."
                  placeholderTextColor={THEME.textMuted}
                  value={actionNoteText}
                  onChangeText={setActionNoteText}
                  multiline
                />
                <TouchableOpacity style={styles.modalActionSubmitBtn} onPress={handleSaveLeadNote}>
                  <Text style={styles.modalActionSubmitBtnText}>Save Note to CRM</Text>
                </TouchableOpacity>
              </View>
            )}

            {actionModalType === "reminder" && (
              <View style={{ marginTop: 14 }}>
                <Text style={styles.fieldLabel}>Quick Callback In:</Text>
                <View style={styles.followupChipsRow}>
                  {[15, 30, 60, 120].map((mins) => (
                    <TouchableOpacity
                      key={mins}
                      style={[
                        styles.followupChip,
                        quickActionReminderMinutes === mins && styles.followupChipActive,
                      ]}
                      onPress={() => setQuickActionReminderMinutes(mins)}
                    >
                      <Clock size={12} color={quickActionReminderMinutes === mins ? THEME.primary : THEME.textSecondary} strokeWidth={2} />
                      <Text
                        style={[
                          styles.followupChipText,
                          quickActionReminderMinutes === mins && styles.followupChipTextActive,
                        ]}
                      >
                        {mins < 60 ? `${mins}m` : `${mins / 60}h`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity style={styles.modalActionSubmitBtn} onPress={handleSaveLeadReminder}>
                  <Text style={styles.modalActionSubmitBtnText}>Schedule Callback</Text>
                </TouchableOpacity>
              </View>
            )}

            {actionModalType === "stage" && (
              <View style={{ marginTop: 14 }}>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                  {stagesList.map((st) => (
                    <TouchableOpacity
                      key={st}
                      style={[
                        styles.dispPill,
                        selectedActionStage === st && styles.dispPillActive,
                      ]}
                      onPress={() => setSelectedActionStage(st)}
                    >
                      <Text
                        style={[
                          styles.dispPillText,
                          selectedActionStage === st && styles.dispPillTextActive,
                        ]}
                      >
                        {st}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity style={styles.modalActionSubmitBtn} onPress={handleSaveLeadStage}>
                  <Text style={styles.modalActionSubmitBtnText}>Update Lead Stage</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL 4: Add Lead Modal */}
      <Modal
        visible={addLeadModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAddLeadModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.addLeadModalSheet}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={styles.sectionHeading}>Add New Contact</Text>
              <TouchableOpacity onPress={() => setAddLeadModalVisible(false)}>
                <X size={18} color={THEME.textMuted} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Contact Name *</Text>
            <TextInput
              style={styles.textInputLight}
              placeholder="e.g. Ramesh Patel"
              placeholderTextColor={THEME.textMuted}
              value={newLeadName}
              onChangeText={setNewLeadName}
            />

            <Text style={styles.fieldLabel}>Phone Number *</Text>
            <TextInput
              style={styles.textInputLight}
              placeholder="e.g. 9876543210"
              placeholderTextColor={THEME.textMuted}
              keyboardType="phone-pad"
              value={newLeadPhone}
              onChangeText={setNewLeadPhone}
            />

            <Text style={styles.fieldLabel}>Initial Stage</Text>
            <TextInput
              style={styles.textInputLight}
              placeholder="New Lead"
              placeholderTextColor={THEME.textMuted}
              value={newLeadStage}
              onChangeText={setNewLeadStage}
            />

            <Text style={styles.fieldLabel}>Initial Requirement / Notes</Text>
            <TextInput
              style={styles.remarksInput}
              placeholder="Interested in 20 kW Solar installation..."
              placeholderTextColor={THEME.textMuted}
              value={newLeadNotes}
              onChangeText={setNewLeadNotes}
              multiline
            />

            <TouchableOpacity style={styles.addLeadSubmitBtn} onPress={handleAddNewLead}>
              <Text style={styles.addLeadSubmitBtnText}>Save Lead to CRM</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL 5: Universal Hardware Calibration Wizard Modal */}
      <Modal
        visible={setupWizardVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSetupWizardVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.calibrationModalSheet}>
            <View style={styles.detailsHeader}>
              <Text style={styles.detailsTitle}>Hardware Calibration Wizard</Text>
              <TouchableOpacity onPress={() => setSetupWizardVisible(false)}>
                <X size={20} color={THEME.textSecondary} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 12 }}>
              <Text style={styles.calibrationHeaderNote}>
                Universal Android multi-OEM verification for Realme / Oppo / Samsung / Xiaomi dialers:
              </Text>

              {[
                { title: "1. Phone Brand Auto-Detected", desc: "Realme RMX3869 (ColorOS 14 / Android 14)", done: true },
                { title: "2. Telephony & CallLog Access", desc: "CALL_PHONE & READ_CALL_LOG permissions granted", done: true },
                { title: "3. Stock Dialer Auto-Record", desc: "'Record all calls automatically' enabled in dialer", done: true },
                { title: "4. Carrier Wi-Fi Calling (VoWiFi)", desc: "VoWiFi toggled OFF (prevents carrier log bypass)", done: true },
                { title: "5. Initial Calibration Call", desc: "First test call executed to initialize directory", done: true },
                { title: "6. SAF Folder Permission", desc: "Granted access to /Recordings/Call Recordings", done: true },
                { title: "7. Battery Optimization", desc: "Exempted / Unrestricted background execution", done: true },
              ].map((step, idx) => (
                <View key={idx} style={styles.calibrationStepRow}>
                  <View style={styles.calibrationStepCheck}>
                    <Check size={14} color="#FFFFFF" strokeWidth={3} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.calibrationStepTitle}>{step.title}</Text>
                    <Text style={styles.calibrationStepDesc}>{step.desc}</Text>
                  </View>
                </View>
              ))}

              <View style={styles.safeSimBanner}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <ShieldCheck size={15} color={THEME.greenText} strokeWidth={2.5} />
                  <Text style={styles.safeSimBannerTitle}>Safe Simulation Mode Active</Text>
                </View>
                <Text style={styles.safeSimBannerText}>
                  Zero real cellular calls will be placed. Outbox and dispositions run realistically without disturbing real numbers.
                </Text>
              </View>

              <TouchableOpacity
                style={styles.modalActionSubmitBtn}
                onPress={() => setSetupWizardVisible(false)}
              >
                <Text style={styles.modalActionSubmitBtnText}>Complete Calibration</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL 6: Auto-Dialer Fullscreen Cockpit */}
      <AutoDialCockpit
        visible={isAutoDialActive && !dispositionModalVisible}
        status={autoDialStatus}
        isPaused={isAutoDialPaused}
        countdownSec={countdownSec}
        callGapSec={callGapSec}
        currentLead={autoDialCurrentLead}
        currentLeadIndex={autoDialLeadIndex}
        totalQueueCount={autoDialTotalQueueCount}
        dialedCount={autoDialDialedCount}
        connectRate={autoDialConnectRate}
        talkTimeSec={autoDialTalkTimeSec}
        onPause={pauseAutoDialer}
        onResume={resumeAutoDialer}
        onSkip={autoDialSkipLead}
        onDialNow={autoDialDialNow}
        onStop={stopAutoDialer}
        onSelectGap={setCallGapSec}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.bg,
    paddingTop: Platform.OS === "android" ? 36 : 0,
  },
  contentScroll: {
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: THEME.card,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  headerUserRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  userAvatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  userAvatarText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
  headerGreeting: {
    fontSize: 16,
    fontWeight: "700",
    color: THEME.text,
  },
  headerRoleSubtitle: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 1,
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  syncStatusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: THEME.greenLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  syncStatusChipActive: {
    backgroundColor: THEME.primaryLight,
    borderColor: THEME.primarySoft,
  },
  syncDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.green,
  },
  syncDotActive: {
    backgroundColor: THEME.primary,
  },
  syncStatusText: {
    fontSize: 11,
    fontWeight: "700",
    color: THEME.greenText,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  headerIconBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.red,
    position: "absolute",
    top: 7,
    right: 8,
  },
  permissionActionBanner: {
    backgroundColor: THEME.amberLight,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#FDE68A",
  },
  permissionActionTitle: {
    color: THEME.amberText,
    fontSize: 13,
    fontWeight: "700",
  },
  permissionActionSubtitle: {
    color: "#92400E",
    fontSize: 11,
    marginTop: 2,
    lineHeight: 16,
  },
  targetCard: {
    backgroundColor: THEME.card,
    borderRadius: 18,
    padding: 16,
    marginTop: 14,
    borderWidth: 1,
    borderColor: THEME.border,
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  targetCardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  targetCardLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: THEME.textSecondary,
  },
  targetCardNumbers: {
    fontSize: 26,
    fontWeight: "800",
    color: THEME.text,
    marginVertical: 4,
  },
  streakBadgeSmall: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: THEME.amberLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  streakBadgeSmallText: {
    fontSize: 11,
    fontWeight: "700",
    color: THEME.amberText,
  },
  targetProgressCircleWrapper: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 4,
    borderColor: THEME.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  targetProgressCircle: {
    alignItems: "center",
    justifyContent: "center",
  },
  targetProgressPercentText: {
    fontSize: 18,
    fontWeight: "800",
    color: THEME.primary,
  },
  targetProgressSubtext: {
    fontSize: 9,
    fontWeight: "600",
    color: THEME.textSecondary,
  },
  targetProgressBarTrack: {
    height: 6,
    backgroundColor: "#F1F5F9",
    borderRadius: 3,
    marginTop: 14,
    overflow: "hidden",
  },
  targetProgressBarFill: {
    height: "100%",
    backgroundColor: THEME.primary,
    borderRadius: 3,
  },
  statGrid: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  statBox: {
    flex: 1,
    backgroundColor: THEME.card,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: "center",
    borderWidth: 1,
    borderColor: THEME.border,
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  statIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: "800",
    color: THEME.text,
  },
  statTitle: {
    fontSize: 9.5,
    fontWeight: "600",
    color: THEME.textSecondary,
    marginTop: 2,
    textAlign: "center",
  },
  nextLeadCard: {
    backgroundColor: THEME.primaryLight,
    borderRadius: 16,
    padding: 16,
    marginTop: 14,
    borderWidth: 1,
    borderColor: THEME.primarySoft,
  },
  nextLeadPretitle: {
    fontSize: 11,
    fontWeight: "700",
    color: THEME.primary,
    letterSpacing: 0.5,
  },
  simPillSmall: {
    backgroundColor: THEME.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  simPillSmallText: {
    fontSize: 10,
    fontWeight: "700",
    color: THEME.primaryHover,
  },
  nextLeadName: {
    fontSize: 18,
    fontWeight: "800",
    color: THEME.text,
    marginTop: 6,
  },
  nextLeadCompany: {
    fontSize: 13,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  nextLeadActionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  nextLeadDialBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: THEME.primary,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 10,
  },
  nextLeadDialBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  nextLeadQueueBtn: {
    flex: 0.95,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.primarySoft,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 10,
  },
  nextLeadQueueBtnText: {
    color: THEME.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 8,
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: "800",
    color: THEME.text,
  },
  sectionHeadingLink: {
    fontSize: 13,
    fontWeight: "700",
    color: THEME.primary,
  },
  sectionSubtext: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 1,
  },
  activityTimelineCard: {
    backgroundColor: THEME.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
  },
  activityDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  activityItemTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: THEME.text,
  },
  activityItemTime: {
    fontSize: 11,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  activityBadgeSuccess: {
    backgroundColor: THEME.greenLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  activityBadgeSuccessText: {
    color: THEME.greenText,
    fontSize: 11,
    fontWeight: "700",
  },
  activityActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: THEME.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.primarySoft,
  },
  activityActionBtnText: {
    color: THEME.primary,
    fontSize: 11,
    fontWeight: "700",
  },
  activityDivider: {
    height: 1,
    backgroundColor: THEME.borderLight,
    marginVertical: 4,
  },
  leadsHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
    marginBottom: 10,
  },
  addLeadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: THEME.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addLeadBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: THEME.border,
    gap: 8,
  },
  searchBarInput: {
    flex: 1,
    fontSize: 13,
    color: THEME.text,
  },
  filterPillsScroll: {
    marginTop: 10,
    marginBottom: 10,
  },
  filterPill: {
    backgroundColor: THEME.card,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  filterPillActive: {
    backgroundColor: THEME.primary,
    borderColor: THEME.primary,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: THEME.textSecondary,
  },
  filterPillTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  missedCard: {
    backgroundColor: THEME.amberLight,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  missedCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  missedCardTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: THEME.amberText,
  },
  urgencyTag: {
    backgroundColor: THEME.redLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  urgencyTagText: {
    fontSize: 10,
    fontWeight: "700",
    color: THEME.redText,
  },
  missedCardDesc: {
    fontSize: 11,
    color: "#92400E",
    marginTop: 2,
    marginBottom: 10,
  },
  missedItemRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.card,
    borderRadius: 12,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#FEF3C7",
  },
  missedAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.amber,
    alignItems: "center",
    justifyContent: "center",
  },
  missedAvatarText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 11,
  },
  missedLeadName: {
    fontSize: 13,
    fontWeight: "700",
    color: THEME.text,
  },
  missedTime: {
    fontSize: 10,
    color: THEME.textSecondary,
    marginTop: 1,
  },
  missedActionsGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  missedCallBackBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: THEME.green,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  missedCallBackBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  missedMiniAction: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: THEME.greenLight,
    alignItems: "center",
    justifyContent: "center",
  },
  missedDismissBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  leadCard: {
    backgroundColor: THEME.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: THEME.border,
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  leadCardTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  leadBuildingBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: THEME.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  leadName: {
    flex: 1,
    marginRight: 8,
    fontSize: 15,
    fontWeight: "700",
    color: THEME.text,
  },
  leadSubtitle: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  stageBadge: {
    flexShrink: 0,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  stageBadgeNew: {
    backgroundColor: THEME.greenLight,
  },
  stageBadgeFollow: {
    backgroundColor: THEME.amberLight,
  },
  stageBadgeQualified: {
    backgroundColor: THEME.primaryLight,
  },
  stageBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  stageBadgeTextNew: {
    color: THEME.greenText,
  },
  stageBadgeTextFollow: {
    color: THEME.amberText,
  },
  stageBadgeTextQualified: {
    color: THEME.primary,
  },
  leadNotesPreviewBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 10,
  },
  leadNotesPreviewText: {
    fontSize: 11,
    color: THEME.textSecondary,
    flex: 1,
  },
  leadChipsRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
    flexWrap: "wrap",
  },
  microChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
  },
  microChipText: {
    fontSize: 10,
    color: THEME.textSecondary,
    fontWeight: "600",
  },
  leadActionsRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 10,
  },
  leadDialBtn: {
    flex: 1.1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: THEME.primary,
    paddingVertical: 8,
    borderRadius: 9,
  },
  leadDialBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  leadWhatsAppBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: THEME.greenLight,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    paddingVertical: 8,
    borderRadius: 9,
  },
  leadWhatsAppBtnText: {
    color: THEME.greenText,
    fontSize: 12,
    fontWeight: "700",
  },
  leadSmsBtn: {
    flex: 0.8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: THEME.primaryLight,
    borderWidth: 1,
    borderColor: THEME.primarySoft,
    paddingVertical: 8,
    borderRadius: 9,
  },
  leadSmsBtnText: {
    color: THEME.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  segmentContainer: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 3,
    marginTop: 14,
    marginBottom: 14,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
  },
  segmentBtnActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: THEME.textSecondary,
  },
  segmentBtnTextActive: {
    color: THEME.primary,
    fontWeight: "700",
  },
  performanceHeroCard: {
    backgroundColor: THEME.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  heroCardLabel: {
    fontSize: 12,
    color: THEME.textSecondary,
    fontWeight: "600",
  },
  heroCardNumber: {
    fontSize: 28,
    fontWeight: "800",
    color: THEME.text,
    marginTop: 2,
  },
  trendPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: THEME.greenLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  trendPillText: {
    color: THEME.greenText,
    fontWeight: "700",
    fontSize: 11,
  },
  chartBarRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 90,
    marginTop: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: THEME.borderLight,
  },
  chartBarCol: {
    alignItems: "center",
    flex: 1,
  },
  chartBarPill: {
    width: 14,
    backgroundColor: THEME.primary,
    borderRadius: 7,
  },
  chartDayText: {
    fontSize: 10,
    color: THEME.textMuted,
    marginTop: 6,
    fontWeight: "600",
  },
  leaderboardCard: {
    backgroundColor: THEME.card,
    borderRadius: 18,
    padding: 16,
    marginTop: 14,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  leaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.borderLight,
  },
  rankBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: THEME.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  rankBadgeText: {
    color: THEME.primary,
    fontWeight: "800",
    fontSize: 12,
  },
  leaderName: {
    fontSize: 13,
    fontWeight: "700",
    color: THEME.text,
  },
  leaderCalls: {
    fontSize: 11,
    color: THEME.textSecondary,
    marginTop: 1,
  },
  ratePill: {
    backgroundColor: THEME.greenLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  ratePillText: {
    color: THEME.greenText,
    fontWeight: "700",
    fontSize: 11,
  },
  pipelineCard: {
    backgroundColor: THEME.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  pipelineStepRow: {
    marginBottom: 14,
  },
  pipelineStepName: {
    fontSize: 13,
    fontWeight: "700",
    color: THEME.text,
  },
  pipelineStepCount: {
    fontSize: 11,
    color: THEME.textSecondary,
    fontWeight: "600",
  },
  pipelineTrack: {
    height: 8,
    backgroundColor: "#F1F5F9",
    borderRadius: 4,
    overflow: "hidden",
  },
  pipelineFill: {
    height: "100%",
    borderRadius: 4,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.card,
    borderRadius: 18,
    padding: 16,
    marginTop: 14,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  profileAvatarLarge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: THEME.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  profileAvatarLargeText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  profileName: {
    fontSize: 16,
    fontWeight: "800",
    color: THEME.text,
  },
  profileSub: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  profileRoleBadge: {
    fontSize: 11,
    color: THEME.primary,
    fontWeight: "600",
    marginTop: 2,
  },
  settingsGroupCard: {
    backgroundColor: THEME.card,
    borderRadius: 18,
    padding: 16,
    marginTop: 14,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  settingsGroupTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: THEME.text,
  },
  settingsGroupDesc: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 2,
    marginBottom: 10,
  },
  simSlotsRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  simSlotPill: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: THEME.border,
  },
  simSlotPillActive: {
    backgroundColor: THEME.primaryLight,
    borderColor: THEME.primary,
  },
  simSlotPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: THEME.textSecondary,
  },
  simSlotPillTextActive: {
    color: THEME.primary,
    fontWeight: "700",
  },
  healthRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  healthLabel: {
    fontSize: 13,
    color: "#475569",
  },
  healthVal: {
    fontSize: 13,
    fontWeight: "700",
  },
  serverInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: THEME.text,
  },
  chipRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  quickChip: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  quickChipText: {
    fontSize: 11,
    color: "#475569",
    fontWeight: "600",
  },
  syncFullBtn: {
    backgroundColor: THEME.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  syncFullBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
  lastSyncInfo: {
    fontSize: 11,
    color: THEME.textMuted,
    textAlign: "center",
    marginTop: 6,
  },
  historyCard: {
    backgroundColor: THEME.card,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  historyName: {
    fontSize: 14,
    fontWeight: "700",
    color: THEME.text,
  },
  historyTime: {
    fontSize: 11,
    color: THEME.textSecondary,
  },
  outcomePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  outcomePillConnected: {
    backgroundColor: THEME.greenLight,
  },
  outcomePillMissed: {
    backgroundColor: THEME.redLight,
  },
  outcomePillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  outcomePillTextConnected: {
    color: THEME.greenText,
  },
  outcomePillTextMissed: {
    color: THEME.redText,
  },
  historyDispRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: THEME.borderLight,
  },
  historyDispText: {
    fontSize: 11,
    fontWeight: "700",
    color: THEME.primary,
  },
  historyRemarkText: {
    fontSize: 11,
    color: THEME.textSecondary,
  },
  bottomNavContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: Platform.OS === "android" ? 72 : 82,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: THEME.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingBottom: Platform.OS === "android" ? 8 : 18,
    overflow: "visible",
    elevation: 8,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  bottomNavItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
  },
  bottomNavText: {
    fontSize: 11,
    fontWeight: "600",
    color: THEME.textMuted,
    marginTop: 2,
  },
  bottomNavTextActive: {
    color: THEME.primary,
    fontWeight: "700",
  },
  fabWrapper: {
    width: 60,
    alignItems: "center",
    justifyContent: "center",
    top: -20,
    zIndex: 99,
  },
  centerFab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: THEME.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "flex-end",
  },
  detailsModalContent: {
    backgroundColor: THEME.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
    padding: 20,
  },
  detailsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  detailsBackText: {
    color: THEME.text,
    fontSize: 14,
    fontWeight: "700",
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: THEME.text,
  },
  detailsLeadHeaderCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: THEME.border,
  },
  detailsAvatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: THEME.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  detailsLeadName: {
    fontSize: 18,
    fontWeight: "800",
    color: THEME.text,
  },
  detailsLeadCompany: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 2,
    marginBottom: 8,
  },
  detailsActionButtonsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    width: "100%",
  },
  detailsActionDialBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: THEME.primary,
    paddingVertical: 10,
    borderRadius: 10,
  },
  detailsActionDialBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 12,
  },
  detailsActionWhatsAppBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: THEME.greenLight,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    paddingVertical: 10,
    borderRadius: 10,
  },
  detailsActionWhatsAppBtnText: {
    color: THEME.greenText,
    fontWeight: "700",
    fontSize: 12,
  },
  detailsActionMeetingBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: THEME.purpleLight,
    borderWidth: 1,
    borderColor: "#DDD6FE",
    paddingVertical: 10,
    borderRadius: 10,
  },
  detailsActionMeetingBtnText: {
    color: THEME.purpleText,
    fontWeight: "700",
    fontSize: 12,
  },
  detailsTabsRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
    marginTop: 16,
    marginBottom: 12,
  },
  detailsTab: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginRight: 10,
  },
  detailsTabActive: {
    borderBottomWidth: 2,
    borderBottomColor: THEME.primary,
  },
  detailsTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: THEME.textSecondary,
  },
  detailsTabTextActive: {
    color: THEME.primary,
    fontWeight: "700",
  },
  detailsAttributesCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  attrRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  attrLabel: {
    fontSize: 13,
    color: THEME.textSecondary,
  },
  attrVal: {
    fontSize: 13,
    fontWeight: "700",
    color: THEME.text,
  },
  attrDivider: {
    height: 1,
    backgroundColor: THEME.borderLight,
  },
  notesBodyText: {
    fontSize: 13,
    color: THEME.text,
    lineHeight: 18,
    marginTop: 6,
  },
  dispositionModalSheet: {
    backgroundColor: THEME.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
    padding: 20,
  },
  dispModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  dispLeadName: {
    fontSize: 17,
    fontWeight: "800",
    color: THEME.text,
  },
  dispLeadPhone: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 1,
  },
  dispDurationBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: THEME.greenLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  dispDurationBadgeText: {
    color: THEME.greenText,
    fontSize: 12,
    fontWeight: "700",
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: THEME.text,
    marginTop: 12,
    marginBottom: 6,
  },
  outcomeChipsRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  outcomeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  outcomeChipActive: {
    backgroundColor: THEME.primaryLight,
    borderColor: THEME.primary,
  },
  outcomeChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: THEME.textSecondary,
  },
  outcomeChipTextActive: {
    color: THEME.primary,
    fontWeight: "700",
  },
  dispositionPillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  dispPill: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  dispPillActive: {
    backgroundColor: THEME.primaryLight,
    borderColor: THEME.primary,
  },
  dispPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: THEME.textSecondary,
  },
  dispPillTextActive: {
    color: THEME.primary,
    fontWeight: "700",
  },
  followupChipsRow: {
    flexDirection: "row",
    gap: 8,
  },
  followupChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  followupChipActive: {
    backgroundColor: THEME.primaryLight,
    borderColor: THEME.primary,
  },
  followupChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: THEME.textSecondary,
  },
  followupChipTextActive: {
    color: THEME.primary,
    fontWeight: "700",
  },
  remarksInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    color: THEME.text,
    minHeight: 60,
    textAlignVertical: "top",
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 8,
  },
  checkboxBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxBoxChecked: {
    backgroundColor: THEME.primary,
    borderColor: THEME.primary,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 12,
    color: THEME.textSecondary,
    lineHeight: 17,
  },
  saveBtnsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  saveOnlyBtn: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  saveOnlyBtnText: {
    color: THEME.textSecondary,
    fontWeight: "700",
    fontSize: 13,
  },
  saveAndNextBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: THEME.primary,
    paddingVertical: 12,
    borderRadius: 10,
  },
  saveAndNextBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
  actionModalSheet: {
    backgroundColor: THEME.card,
    borderRadius: 18,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 40,
  },
  modalActionSubmitBtn: {
    backgroundColor: THEME.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 14,
  },
  modalActionSubmitBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
  addLeadModalSheet: {
    backgroundColor: THEME.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
    padding: 20,
  },
  textInputLight: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: THEME.text,
  },
  addLeadSubmitBtn: {
    backgroundColor: THEME.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 16,
  },
  addLeadSubmitBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  consentBannerWrapper: {
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    marginBottom: 8,
  },
  consentBannerTitle: {
    fontSize: 10,
    fontWeight: "700",
    color: "#B45309",
    letterSpacing: 0.5,
  },
  consentBannerScript: {
    fontSize: 12,
    color: "#92400E",
    fontStyle: "italic",
    lineHeight: 17,
  },
  consentBannerDetails: {
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 10,
    padding: 10,
    marginVertical: 10,
  },
  offlineBanner: {
    backgroundColor: "#FFFBEB",
    borderBottomWidth: 1,
    borderColor: "#FDE68A",
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  offlineBannerExpired: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  offlineBannerTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#B45309",
    flex: 1,
  },
  offlineSyncQuickBtn: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  offlineSyncQuickBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#B45309",
  },
  unknownCallBanner: {
    backgroundColor: "#F1F5F9",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  unknownCallBannerTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },
  unknownCallBannerSubtitle: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  unknownCallAddBtn: {
    backgroundColor: THEME.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  unknownCallAddBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  calibrationBannerCard: {
    backgroundColor: THEME.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  calibrationIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: THEME.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  calibrationCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: THEME.text,
  },
  calibrationCardSub: {
    fontSize: 11,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  calibrationModalSheet: {
    backgroundColor: THEME.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    padding: 20,
  },
  calibrationHeaderNote: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginBottom: 14,
    lineHeight: 17,
  },
  calibrationStepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: "#F1F5F9",
  },
  calibrationStepCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: THEME.green,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  calibrationStepTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: THEME.text,
  },
  calibrationStepDesc: {
    fontSize: 11,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  safeSimBanner: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
  },
  safeSimBannerTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: THEME.greenText,
  },
  safeSimBannerText: {
    fontSize: 11,
    color: "#065F46",
    marginTop: 3,
    lineHeight: 15,
  },
});
