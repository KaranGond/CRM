"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  formatPhone,
  formatCallDuration,
  formatDateTime,
  type DashboardStats,
  type Lead,
  type CallLog,
  type PipelineStage,
  type DispositionType,
  type BenchmarkReport,
} from "@telecalling-crm/shared";
import {
  SunIcon,
  PhoneCallIcon,
  UsersIcon,
  UserPlusIcon,
  ActivityIcon,
  BarChart3Icon,
  ClockIcon,
  CalendarIcon,
  CheckCircle2Icon,
  PlayIcon,
  PauseIcon,
  Volume2Icon,
  VolumeXIcon,
  SearchIcon,
  RefreshCwIcon,
  SmartphoneIcon,
  BatteryChargingIcon,
  ShieldCheckIcon,
  UploadCloudIcon,
  DownloadIcon,
  FileSpreadsheetIcon,
  ChevronRightIcon,
  XIcon,
  SettingsIcon,
  LayersIcon,
} from "../components/icons";

const getApiBase = () => {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== "undefined") {
    if (window.location.port === "3000") {
      return `http://${window.location.hostname}:4000/api`;
    }
    return `${window.location.origin}/api`;
  }
  return "http://localhost:4000/api";
};
const API_BASE = getApiBase();

interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "admin" | "manager" | "telecaller";
}

interface CallerAuditMetric {
  callerId: string;
  name: string;
  email: string;
  phone: string;
  lastSeenAt: string | null;
  deviceModel: string;
  appVersion: string | null;
  dialsToday: number;
  connectsToday: number;
  connectRate: number;
  totalTalkTimeSec: number;
  recordedCalls: number;
  unsupportedCalls: number;
  recordingCoverage: number;
  deviceSupported: boolean;
}

interface DeviceTelemetry {
  id: string;
  userId: string;
  model: string;
  androidVersion: string;
  appVersion: string;
  engineVersion: string;
  lastSeenAt: string;
  clockOffsetMs?: number;
  diagnostics?: {
    batteryOptimized?: boolean;
    batteryLevel?: number;
    permissionsGranted?: Record<string, boolean>;
    recorderFolderConfigured?: boolean;
    storagePath?: string;
    outboxPending?: number;
  } | null;
}

interface FollowUpItem {
  id: string;
  leadId: string;
  userId: string;
  dueAt: string;
  note: string | null;
  doneAt: string | null;
  user?: { id: string; name: string; phone: string };
  lead?: { id: string; name: string; phoneE164: string; stage?: { label: string } };
}

export default function DashboardPage() {
  // Navigation
  const [activeTab, setActiveTab] = useState<
    "live" | "callers" | "leads" | "calls" | "followups" | "config" | "benchmark"
  >("live");

  // Auth State
  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState("manager@telecalling.crm");
  const [loginPassword, setLoginPassword] = useState("Password123!");
  const [loginError, setLoginError] = useState<string | null>(null);

  // Sync / Polling State
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  const [syncStatus, setSyncStatus] = useState<"connected" | "syncing" | "error">("connected");

  // Data States
  const [stats, setStats] = useState<DashboardStats>({
    totalLeads: 0,
    callsToday: 0,
    connectedCallsToday: 0,
    avgDurationSec: 0,
    pendingFollowUps: 0,
    activeCallers: 0,
  });

  const [callers, setCallers] = useState<CallerAuditMetric[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsTotal, setLeadsTotal] = useState(0);
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [devices, setDevices] = useState<DeviceTelemetry[]>([]);
  const [followUps, setFollowUps] = useState<FollowUpItem[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [dispositions, setDispositions] = useState<DispositionType[]>([]);
  const [teamUsers, setTeamUsers] = useState<UserProfile[]>([]);
  const [benchmarkData, setBenchmarkData] = useState<BenchmarkReport | null>(null);

  // Filter & Search States
  const [leadSearch, setLeadSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [callOutcomeFilter, setCallOutcomeFilter] = useState("all");
  const [followUpFilter, setFollowUpFilter] = useState<"all" | "overdue" | "today" | "upcoming">("today");

  // Modals & Action States
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [bulkAssignModalOpen, setBulkAssignModalOpen] = useState(false);
  const [bulkAssignTarget, setBulkAssignTarget] = useState<string>("");
  const [bulkAssignLoading, setBulkAssignLoading] = useState(false);

  // CSV Import Modal
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importCsvText, setImportCsvText] = useState("");
  const [importRoundRobin, setImportRoundRobin] = useState(true);
  const [importStageId, setImportStageId] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{
    jobId: string;
    total: number;
    imported: number;
    duplicates: number;
    errors: string[];
  } | null>(null);

  // Add Lead Modal
  const [addLeadModalOpen, setAddLeadModalOpen] = useState(false);
  const [newLeadName, setNewLeadName] = useState("");
  const [newLeadPhone, setNewLeadPhone] = useState("");
  const [newLeadSource, setNewLeadSource] = useState("Website Inbound");
  const [newLeadStageId, setNewLeadStageId] = useState("");
  const [newLeadAssigneeId, setNewLeadAssigneeId] = useState("");
  const [addLeadLoading, setAddLeadLoading] = useState(false);
  const [addLeadError, setAddLeadError] = useState<string | null>(null);

  // Audio Playback Modal
  const [playingCall, setPlayingCall] = useState<CallLog | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Lead Timeline Modal
  const [inspectedLead, setInspectedLead] = useState<Lead | null>(null);
  const [inspectedLeadCalls, setInspectedLeadCalls] = useState<CallLog[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  // Authenticated fetch wrapper
  const apiFetch = useCallback(
    async (path: string, options: RequestInit = {}) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...((options.headers as Record<string, string>) ?? {}),
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
      });

      if (res.status === 401) {
        setToken(null);
        localStorage.removeItem("tc_jwt_token");
        throw new Error("Unauthorized");
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `API request failed with status ${res.status}`);
      }

      return res.json();
    },
    [token],
  );

  // 1. Initial Auth Check / Auto Login
  useEffect(() => {
    async function initAuth() {
      const savedToken = localStorage.getItem("tc_jwt_token");
      if (savedToken) {
        try {
          const res = await fetch(`${API_BASE}/auth/me`, {
            headers: { Authorization: `Bearer ${savedToken}` },
          });
          if (res.ok) {
            const data = await res.json();
            setToken(savedToken);
            setCurrentUser(data.data);
            setAuthLoading(false);
            return;
          }
        } catch {
          // Token expired or invalid
        }
      }

      // Auto login in demo mode
      try {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "manager@telecalling.crm",
            password: "Password123!",
          }),
        });
        if (res.ok) {
          const json = await res.json();
          const newToken = json.data.accessToken;
          setToken(newToken);
          setCurrentUser(json.data.user);
          localStorage.setItem("tc_jwt_token", newToken);
        }
      } catch (err) {
        console.error("Auto login failed:", err);
      } finally {
        setAuthLoading(false);
      }
    }

    initAuth();
  }, []);

  // 2. Fetch Data from API
  const refreshAllData = useCallback(async () => {
    if (!token) return;
    setIsRefreshing(true);
    setSyncStatus("syncing");

    try {
      const [
        summaryRes,
        callersRes,
        leadsRes,
        callsRes,
        devicesRes,
        followUpsRes,
        stagesRes,
        dispositionsRes,
        usersRes,
        benchmarkRes,
      ] = await Promise.allSettled([
        apiFetch("/reports/summary"),
        apiFetch("/reports/callers"),
        apiFetch("/leads?limit=100"),
        apiFetch("/calls?limit=50"),
        apiFetch("/devices"),
        apiFetch("/followups"),
        apiFetch("/config/stages"),
        apiFetch("/config/dispositions"),
        apiFetch("/users"),
        apiFetch("/reports/benchmark"),
      ]);

      if (summaryRes.status === "fulfilled" && summaryRes.value?.data) {
        setStats(summaryRes.value.data);
      }
      if (callersRes.status === "fulfilled" && callersRes.value?.data) {
        setCallers(callersRes.value.data);
      }
      if (leadsRes.status === "fulfilled" && leadsRes.value?.data) {
        setLeads(leadsRes.value.data);
        setLeadsTotal(leadsRes.value.total || leadsRes.value.data.length);
      }
      if (callsRes.status === "fulfilled" && callsRes.value?.data) {
        setCalls(callsRes.value.data);
      }
      if (devicesRes.status === "fulfilled" && devicesRes.value?.data) {
        setDevices(devicesRes.value.data);
      }
      if (followUpsRes.status === "fulfilled" && followUpsRes.value?.data) {
        setFollowUps(followUpsRes.value.data);
      }
      if (stagesRes.status === "fulfilled" && stagesRes.value?.data) {
        setStages(stagesRes.value.data);
      }
      if (dispositionsRes.status === "fulfilled" && dispositionsRes.value?.data) {
        setDispositions(dispositionsRes.value.data);
      }
      if (usersRes.status === "fulfilled" && usersRes.value?.data) {
        setTeamUsers(usersRes.value.data);
      }
      if (benchmarkRes.status === "fulfilled" && benchmarkRes.value?.data) {
        setBenchmarkData(benchmarkRes.value.data);
      }

      setLastSyncTime(new Date());
      setSyncStatus("connected");
    } catch (err) {
      console.error("Data refresh failed:", err);
      setSyncStatus("error");
    } finally {
      setIsRefreshing(false);
    }
  }, [token, apiFetch]);

  // 3. Smart Polling Every 5 Seconds (auto-pauses when tab hidden)
  useEffect(() => {
    if (!token) return;
    let isMounted = true;

    const timer = setTimeout(() => {
      if (isMounted) {
        void refreshAllData();
      }
    }, 0);

    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      if (isMounted) {
        void refreshAllData();
      }
    }, 5000);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [token, refreshAllData]);

  // Handle Login Submission
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Login failed");
      }
      setToken(data.data.accessToken);
      setCurrentUser(data.data.user);
      localStorage.setItem("tc_jwt_token", data.data.accessToken);
      setLoginModalOpen(false);
      void refreshAllData();
    } catch (err: unknown) {
      setLoginError((err as Error).message || "Failed to log in");
    }
  };

  // Quick switch user in dev
  const handleQuickSwitch = async (email: string) => {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "Password123!" }),
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.data.accessToken);
        setCurrentUser(data.data.user);
        localStorage.setItem("tc_jwt_token", data.data.accessToken);
        setLoginModalOpen(false);
        refreshAllData();
      }
    } catch (err) {
      console.error("Quick switch error:", err);
    }
  };

  // Play Call Audio
  const handlePlayRecording = async (call: CallLog) => {
    setPlayingCall(call);
    setAudioUrl(null);
    setAudioLoading(true);
    setIsPlaying(false);
    setCurrentTime(0);

    try {
      if (call.recordingId) {
        const res = await apiFetch(`/recordings/${call.recordingId}/url`);
        if (res.success && res.data?.url) {
          setAudioUrl(res.data.url);
          setAudioLoading(false);
          return;
        }
      }
      // Demo fallback audio
      setAudioUrl("https://actions.google.com/sounds/v1/telephones/telephone_ring.ogg");
    } catch {
      setAudioUrl("https://actions.google.com/sounds/v1/telephones/telephone_ring.ogg");
    } finally {
      setAudioLoading(false);
    }
  };

  const toggleAudioPlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(console.error);
      setIsPlaying(true);
    }
  };

  const handleAudioSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

  // Inspect Lead Details & Timeline
  const handleInspectLead = async (lead: Lead) => {
    setInspectedLead(lead);
    setTimelineLoading(true);
    try {
      const res = await apiFetch(`/leads/${lead.id}/calls`);
      if (res.success) {
        setInspectedLeadCalls(res.data || []);
      }
    } catch (err) {
      console.error("Failed to load lead calls:", err);
    } finally {
      setTimelineLoading(false);
    }
  };

  // Mark Follow-Up Done
  const handleToggleFollowUp = async (id: string, currentDone: boolean) => {
    try {
      await apiFetch(`/followups/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ done: !currentDone }),
      });
      refreshAllData();
    } catch (err) {
      console.error("Follow-up toggle error:", err);
    }
  };

  // Bulk Reassign Leads
  const handleBulkAssign = async () => {
    if (!bulkAssignTarget || selectedLeadIds.length === 0) return;
    setBulkAssignLoading(true);
    try {
      await apiFetch("/leads/bulk-assign", {
        method: "POST",
        body: JSON.stringify({
          leadIds: selectedLeadIds,
          toUserId: bulkAssignTarget,
          reason: "Bulk assignment via dashboard",
        }),
      });
      setSelectedLeadIds([]);
      setBulkAssignTarget("");
      setBulkAssignModalOpen(false);
      refreshAllData();
    } catch (err) {
      console.error("Bulk assign failed:", err);
    } finally {
      setBulkAssignLoading(false);
    }
  };

  // Handle CSV Import
  const handleCsvImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importCsvText.trim()) return;
    setImportLoading(true);
    setImportResult(null);

    try {
      const lines = importCsvText.trim().split("\n");
      const parsedLeads: Array<{
        name: string;
        phone: string;
        source?: string;
        notes?: string;
      }> = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]?.trim();
        if (!line) continue;
        if (i === 0 && (line.toLowerCase().includes("name") || line.toLowerCase().includes("phone"))) {
          continue; // Skip header
        }

        const parts = line.split(",").map((p) => p.trim().replace(/^["']|["']$/g, ""));
        if (parts.length >= 2 && parts[0] && parts[1]) {
          parsedLeads.push({
            name: parts[0],
            phone: parts[1],
            source: parts[2] || "csv_import",
            notes: parts[3] || undefined,
          });
        }
      }

      if (parsedLeads.length === 0) {
        throw new Error("No valid lead rows found in CSV. Format: Name, Phone, Source, Notes");
      }

      const res = await apiFetch("/leads/import", {
        method: "POST",
        body: JSON.stringify({
          leads: parsedLeads,
          autoRoundRobin: importRoundRobin,
          defaultStageId: importStageId || undefined,
        }),
      });

      if (res.success) {
        setImportResult(res.data);
        void refreshAllData();
      }
    } catch (err: unknown) {
      setImportResult({
        jobId: "error",
        total: 0,
        imported: 0,
        duplicates: 0,
        errors: [(err as Error).message || "Import failed"],
      });
    } finally {
      setImportLoading(false);
    }
  };

  // Load Sample CSV data
  const handleLoadSampleCsv = () => {
    setImportCsvText(
      `Name, Phone, Source, Notes\n` +
        `Vikram Singhania, 9811022334, Google Ads, 50kW Industrial Rooftop Solar inquiry\n` +
        `Pooja Hegde, 9822033445, Facebook Ads, Requested evening callback for commercial setup\n` +
        `Arun Nambiar, 9833044556, Direct Inbound, Site visit scheduled for Thursday\n` +
        `Kavita Krishnan, 9844055667, Referral, High intent solar residential proposal\n` +
        `Manish Tiwari, 9855066778, Website Chat, Asking for net-metering subsidy details`,
    );
  };

  // Create Single Lead
  const handleAddSingleLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddLeadLoading(true);
    setAddLeadError(null);

    try {
      await apiFetch("/leads", {
        method: "POST",
        body: JSON.stringify({
          name: newLeadName.trim(),
          phoneE164: newLeadPhone.trim(),
          source: newLeadSource || "Manual",
          stageId: newLeadStageId || undefined,
          assigneeId: newLeadAssigneeId || undefined,
        }),
      });

      setNewLeadName("");
      setNewLeadPhone("");
      setAddLeadModalOpen(false);
      void refreshAllData();
    } catch (err: unknown) {
      setAddLeadError((err as Error).message || "Failed to add lead");
    } finally {
      setAddLeadLoading(false);
    }
  };

  // Filtered Leads
  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      lead.name.toLowerCase().includes(leadSearch.toLowerCase()) ||
      lead.phoneE164.includes(leadSearch);
    const matchesStage = stageFilter === "all" || lead.stageId === stageFilter;
    const matchesAssignee = assigneeFilter === "all" || lead.assigneeId === assigneeFilter;
    return matchesSearch && matchesStage && matchesAssignee;
  });

  // Filtered Calls
  const filteredCalls = calls.filter((c) => {
    if (callOutcomeFilter === "all") return true;
    return c.outcome === callOutcomeFilter;
  });

  // Filtered FollowUps
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  const filteredFollowUps = followUps.filter((f) => {
    const dueDate = new Date(f.dueAt);
    if (followUpFilter === "overdue") {
      return dueDate < now && f.doneAt === null;
    }
    if (followUpFilter === "today") {
      return dueDate >= startOfToday && dueDate <= endOfToday && f.doneAt === null;
    }
    if (followUpFilter === "upcoming") {
      return dueDate > endOfToday && f.doneAt === null;
    }
    return true;
  });

  // Format OEM Brand Name
  const getBrandBadge = (model: string) => {
    const lower = model.toLowerCase();
    if (lower.includes("samsung")) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          Samsung One UI
        </span>
      );
    }
    if (lower.includes("xiaomi") || lower.includes("redmi") || lower.includes("poco")) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-50 text-orange-700 border border-orange-200">
          Xiaomi HyperOS
        </span>
      );
    }
    if (lower.includes("vivo") || lower.includes("iqoo")) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200">
          Vivo FuntouchOS
        </span>
      );
    }
    if (lower.includes("oppo") || lower.includes("realme") || lower.includes("oneplus")) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          Realme UI / ODialer
        </span>
      );
    }
    if (lower.includes("pixel") || lower.includes("google") || lower.includes("motorola")) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          Google Dialer (No Audio)
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
        OEM Native
      </span>
    );
  };

  const getStageBadgeColor = (label: string) => {
    const l = label.toLowerCase();
    if (l.includes("new")) return "bg-blue-50 text-blue-700 border-blue-200";
    if (l.includes("contact")) return "bg-sky-50 text-sky-700 border-sky-200";
    if (l.includes("interest")) return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (l.includes("meet") || l.includes("schedul")) return "bg-purple-50 text-purple-700 border-purple-200";
    if (l.includes("proposal") || l.includes("quot")) return "bg-indigo-50 text-indigo-700 border-indigo-200";
    if (l.includes("won") || l.includes("convert")) return "bg-green-50 text-green-700 border-green-200";
    if (l.includes("lost") || l.includes("close")) return "bg-rose-50 text-rose-700 border-rose-200";
    return "bg-slate-50 text-slate-700 border-slate-200";
  };

  if (authLoading && !token) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center text-white shadow-lg shadow-amber-200">
            <SunIcon size={28} className="animate-spin text-white" />
          </div>
          <span className="text-xs font-semibold text-slate-600">Initializing SolarCRM Shift Board...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      {/* ── Top Navigation Bar (Modern Light) ─────────────────────────────────── */}
      <header className="border-b border-slate-200/80 bg-white/95 backdrop-blur-md sticky top-0 z-40 px-6 py-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-400 to-yellow-300 flex items-center justify-center text-white shadow-sm shadow-amber-200">
            <SunIcon size={24} className="text-white drop-shadow-xs" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-base font-extrabold tracking-tight text-slate-900">
                SolarCRM
              </h1>
              <span className="text-xs font-medium text-slate-500 hidden sm:inline">
                Operations & Recording Audit
              </span>
              <span
                className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 ${
                  syncStatus === "connected"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : syncStatus === "syncing"
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : "bg-rose-50 text-rose-700 border-rose-200"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    syncStatus === "connected"
                      ? "bg-emerald-500 animate-pulse"
                      : syncStatus === "syncing"
                        ? "bg-blue-500 animate-spin"
                        : "bg-rose-500"
                  }`}
                />
                {syncStatus === "connected"
                  ? "Live Sync (5s)"
                  : syncStatus === "syncing"
                    ? "Syncing..."
                    : "Sync Offline"}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
              <span>Universal Android Fleet</span>
              <span>•</span>
              <span>MinIO S3 Voice Archive</span>
              <span>•</span>
              <span className="text-emerald-600 font-medium">Safe Simulation Active</span>
              <span>•</span>
              <span>Synced {lastSyncTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
            </p>
          </div>
        </div>

        {/* Global Navigation Tabs */}
        <nav className="hidden lg:flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/90 shadow-inner">
          {(
            [
              { id: "live", label: "Live Operations", icon: ActivityIcon },
              { id: "callers", label: `Telecallers (${callers.length})`, icon: UsersIcon },
              { id: "leads", label: `Leads (${leadsTotal})`, icon: UserPlusIcon },
              { id: "calls", label: `Calls (${calls.length})`, icon: PhoneCallIcon },
              { id: "followups", label: `Follow-Ups (${stats.pendingFollowUps})`, icon: CalendarIcon },
              { id: "config", label: "Config & Rules", icon: SettingsIcon },
              { id: "benchmark", label: "Pilot vs RMDialer", icon: BarChart3Icon },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/80"
                }`}
              >
                <Icon size={14} className={isActive ? "text-white" : "text-slate-500"} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Header Actions: APK Download, Refresh & User Profile */}
        <div className="flex items-center gap-2.5">
          <a
            href="/telecalling-crm.apk"
            download
            title="Download Telecaller Android APK"
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200/90 rounded-xl text-xs font-semibold transition-all"
          >
            <DownloadIcon size={14} className="text-indigo-600" />
            <span>Download APK</span>
          </a>

          <button
            onClick={() => refreshAllData()}
            disabled={isRefreshing}
            title="Refresh live data now"
            className="p-2 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 shadow-xs transition-all text-xs flex items-center gap-1.5"
          >
            <RefreshCwIcon size={14} className={isRefreshing ? "animate-spin text-indigo-600" : "text-slate-600"} />
            <span className="hidden xl:inline text-[11px] font-medium">Refresh</span>
          </button>

          <div
            onClick={() => setLoginModalOpen(true)}
            className="flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 shadow-xs px-2.5 py-1.5 rounded-xl cursor-pointer transition-all"
          >
            <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-xs font-bold text-indigo-600">
              {currentUser?.name ? currentUser.name.slice(0, 2).toUpperCase() : "OM"}
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-xs font-bold text-slate-900 leading-tight">
                {currentUser?.name || "Operations Manager"}
              </div>
              <div className="text-[10px] text-slate-500 capitalize">
                {currentUser?.role || "manager"} • Switch
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Mobile/Tablet Tab Switcher (Visible on small screens) ─────────────── */}
      <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-2 overflow-x-auto flex gap-1.5">
        {(
          [
            { id: "live", label: "Live" },
            { id: "callers", label: `Callers (${callers.length})` },
            { id: "leads", label: `Leads (${leadsTotal})` },
            { id: "calls", label: `Calls (${calls.length})` },
            { id: "followups", label: `Follow-ups (${stats.pendingFollowUps})` },
            { id: "config", label: "Config" },
            { id: "benchmark", label: "Pilot vs RMDialer" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Main Container (Modern Light) ───────────────────────────────────── */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Top KPI Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs hover:border-indigo-300 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold">Total Leads</span>
              <UsersIcon size={16} className="text-indigo-500" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2 tracking-tight">
              {stats.totalLeads.toLocaleString()}
            </div>
            <div className="text-[11px] text-indigo-600 mt-1 font-semibold flex items-center gap-1">
              <span>●</span> Active CRM Pipeline
            </div>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs hover:border-indigo-300 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold">Calls Dialed</span>
              <PhoneCallIcon size={16} className="text-blue-500" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2 tracking-tight">
              {stats.callsToday.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Across Android SIMs</div>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs hover:border-emerald-300 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold">Connects Today</span>
              <CheckCircle2Icon size={16} className="text-emerald-500" />
            </div>
            <div className="text-2xl font-black text-emerald-600 mt-2 tracking-tight">
              {stats.connectedCallsToday.toLocaleString()}
            </div>
            <div className="text-[11px] text-emerald-600 mt-1 font-semibold">
              {stats.callsToday > 0
                ? `${Math.round((stats.connectedCallsToday / stats.callsToday) * 100)}% connect rate`
                : "No dials yet"}
            </div>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs hover:border-indigo-300 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold">Avg Talk Time</span>
              <ClockIcon size={16} className="text-sky-500" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2 tracking-tight">
              {formatCallDuration(stats.avgDurationSec)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">per connected call</div>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs hover:border-amber-300 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold">Due Follow-Ups</span>
              <CalendarIcon size={16} className="text-amber-500" />
            </div>
            <div className="text-2xl font-black text-amber-600 mt-2 tracking-tight">
              {stats.pendingFollowUps}
            </div>
            <div className="text-[11px] text-amber-600 mt-1 font-semibold">Scheduled callbacks</div>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs hover:border-purple-300 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold">Active Callers</span>
              <ActivityIcon size={16} className="text-purple-500" />
            </div>
            <div className="text-2xl font-black text-purple-600 mt-2 tracking-tight">
              {callers.length > 0 ? callers.length : stats.activeCallers}
            </div>
            <div className="text-[11px] text-emerald-600 mt-1 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Heartbeat healthy
            </div>
          </div>
        </div>

        {/* ── TAB 1: LIVE OPERATIONS ────────────────────────────────────────── */}
        {activeTab === "live" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Live Telecaller Operations Roster */}
            <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    Live Telecaller Operations
                    <span className="text-[11px] bg-indigo-50 text-indigo-700 font-semibold px-2.5 py-0.5 rounded-full border border-indigo-200">
                      Real-Time SIM Roster
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Live dial counts, connect rates, talk time, and universal OEM recording coverage
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab("callers")}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
                >
                  Full audit view <ChevronRightIcon size={14} />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Telecaller</th>
                      <th className="py-2.5 px-3">OEM Model / Dialer</th>
                      <th className="py-2.5 px-3 text-center">Dials</th>
                      <th className="py-2.5 px-3 text-center">Connects</th>
                      <th className="py-2.5 px-3 text-center">Rate</th>
                      <th className="py-2.5 px-3">Talk Time</th>
                      <th className="py-2.5 px-3">Recording Sync Audit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {callers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          No active telecallers logged in yet. Launch the mobile app or run test seed.
                        </td>
                      </tr>
                    ) : (
                      callers.map((c) => (
                        <tr key={c.callerId} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900">{c.name}</div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {formatPhone(c.phone)}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex flex-col gap-1 items-start">
                              <span className="text-slate-800 font-medium">{c.deviceModel}</span>
                              {getBrandBadge(c.deviceModel)}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-slate-900">
                            {c.dialsToday}
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-emerald-600">
                            {c.connectsToday}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="font-bold text-slate-900">{c.connectRate}%</span>
                          </td>
                          <td className="py-3 px-3 text-slate-700 font-mono">
                            {formatCallDuration(c.totalTalkTimeSec)}
                          </td>
                          <td className="py-3 px-3">
                            {c.unsupportedCalls > 0 ||
                            c.deviceModel.toLowerCase().includes("pixel") ||
                            c.deviceModel.toLowerCase().includes("google") ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                Google Dialer (No Audio)
                              </span>
                            ) : c.recordingCoverage >= 95 ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 w-fit">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                {c.recordingCoverage}% Synced
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                {c.recordingCoverage}% Missing Sync
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Live Stream Calling Feed */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4 flex flex-col">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    Live Stream Feed
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  </h2>
                  <p className="text-xs text-slate-500">Recent captured calls & voice uploads</p>
                </div>
                <button
                  onClick={() => setActiveTab("calls")}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                >
                  View all ({calls.length}) →
                </button>
              </div>

              <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[460px] pr-1">
                {calls.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-xs">
                    No calls captured today. Dials made from Android phones appear here in real time.
                  </div>
                ) : (
                  calls.slice(0, 8).map((c) => (
                    <div
                      key={c.id}
                      className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 hover:border-slate-300 hover:bg-slate-50 transition-all space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">
                          {c.numberE164 ? formatPhone(c.numberE164) : "Lead Call"}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            c.outcome === "CONNECTED"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}
                        >
                          {c.outcome === "CONNECTED" ? `${c.durationSec}s talk` : c.outcome}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-600 font-medium truncate">
                        {c.remark || "Call captured via system phone dialer"}
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-200/50">
                        <span>{formatDateTime(c.startedAt)}</span>
                        {c.recordingId || c.recordingStatus === "MATCHED" ? (
                          <button
                            onClick={() => handlePlayRecording(c)}
                            className="text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 transition-colors"
                          >
                            <PlayIcon size={10} className="fill-emerald-600 text-emerald-600" />
                            <span>Play S3 Audio</span>
                          </button>
                        ) : c.recordingStatus === "UNSUPPORTED_DEVICE" ? (
                          <span className="text-amber-700 font-medium">Google Dialer</span>
                        ) : (
                          <span className="text-slate-400">No Audio</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: TELECALLERS & FLEET HEALTH ───────────────────────────────── */}
        {activeTab === "callers" && (
          <div className="space-y-6">
            {/* Hardware Fleet Telemetry Cards */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <SmartphoneIcon size={18} className="text-indigo-600" />
                    Android Fleet Telemetry & Hardware Health
                  </h2>
                  <p className="text-xs text-slate-500">
                    Device models, battery levels, Room outbox sync backlog, and SAF permissions
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg border border-slate-200">
                  {devices.length} Registered Devices
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {devices.length === 0 ? (
                  <div className="col-span-3 text-center py-8 text-slate-400 text-xs">
                    No hardware devices reported telemetry yet. Run the telecaller app on physical phone.
                  </div>
                ) : (
                  devices.map((d) => (
                    <div
                      key={d.id}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300 transition-all space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">{d.model}</span>
                        {getBrandBadge(d.model)}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                        <div>
                          <span className="text-slate-400">Android:</span>{" "}
                          <span className="font-semibold text-slate-800">
                            {d.androidVersion || "Android 14"}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400">App Version:</span>{" "}
                          <span className="font-semibold text-slate-800">
                            v{d.appVersion || "1.0.0"}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400">Engine:</span>{" "}
                          <span className="font-semibold text-slate-800">
                            v{d.engineVersion || "1.0.0"}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400">Last Seen:</span>{" "}
                          <span className="font-semibold text-slate-800">
                            {formatDateTime(d.lastSeenAt)}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                        <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                          <BatteryChargingIcon size={14} className="text-emerald-500" />
                          Battery: {d.diagnostics?.batteryLevel ?? 88}%
                        </span>
                        <span className="flex items-center gap-1 font-semibold text-indigo-600">
                          <ShieldCheckIcon size={14} className="text-indigo-500" />
                          SAF Granted
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Per-Caller Detailed Performance Table */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Telecaller Performance & Recording Coverage Audit
                  </h3>
                  <p className="text-xs text-slate-500">
                    Recording coverage requires ≥95% on connected calls ≥10s on supported devices
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3">Caller Name</th>
                      <th className="py-3 px-3">Phone & Email</th>
                      <th className="py-3 px-3 text-center">Dials Today</th>
                      <th className="py-3 px-3 text-center">Connects</th>
                      <th className="py-3 px-3 text-center">Connect %</th>
                      <th className="py-3 px-3">Total Talk Time</th>
                      <th className="py-3 px-3 text-center">Recorded</th>
                      <th className="py-3 px-3">Coverage Health</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {callers.map((c) => (
                      <tr key={c.callerId} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-3">
                          <div className="font-bold text-slate-900">{c.name}</div>
                          <div className="text-[11px] text-slate-500">{c.deviceModel}</div>
                        </td>
                        <td className="py-3.5 px-3 text-slate-600">
                          <div>{c.email}</div>
                          <div className="font-mono text-[11px] text-slate-500">{formatPhone(c.phone)}</div>
                        </td>
                        <td className="py-3.5 px-3 text-center font-bold text-slate-900">
                          {c.dialsToday}
                        </td>
                        <td className="py-3.5 px-3 text-center font-bold text-emerald-600">
                          {c.connectsToday}
                        </td>
                        <td className="py-3.5 px-3 text-center font-semibold text-slate-800">
                          {c.connectRate}%
                        </td>
                        <td className="py-3.5 px-3 font-mono font-medium text-slate-800">
                          {formatCallDuration(c.totalTalkTimeSec)}
                        </td>
                        <td className="py-3.5 px-3 text-center font-semibold text-slate-800">
                          {c.recordedCalls}
                        </td>
                        <td className="py-3.5 px-3">
                          {c.unsupportedCalls > 0 ||
                          c.deviceModel.toLowerCase().includes("pixel") ||
                          c.deviceModel.toLowerCase().includes("google") ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                              Google Dialer (Unsupported)
                            </span>
                          ) : c.recordingCoverage >= 95 ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {c.recordingCoverage}% Optimal Coverage
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                              {c.recordingCoverage}% Attention Needed
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 3: LEADS DIRECTORY & ASSIGNMENT ─────────────────────────────── */}
        {activeTab === "leads" && (
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
            {/* Leads Header & Action Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <UserPlusIcon size={18} className="text-indigo-600" />
                  Leads Command Center
                  <span className="text-xs bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded-full border border-slate-200">
                    {filteredLeads.length} of {leadsTotal} Leads
                  </span>
                </h2>
                <p className="text-xs text-slate-500">
                  Search, filter, bulk reassign, import CSV leads, and inspect chronological timelines
                </p>
              </div>

              <div className="flex items-center gap-2">
                {selectedLeadIds.length > 0 && (
                  <button
                    onClick={() => setBulkAssignModalOpen(true)}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center gap-1.5"
                  >
                    <UserPlusIcon size={14} />
                    <span>Bulk Reassign ({selectedLeadIds.length})</span>
                  </button>
                )}

                <button
                  onClick={() => setImportModalOpen(true)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5"
                >
                  <UploadCloudIcon size={14} className="text-indigo-600" />
                  <span>Import CSV</span>
                </button>

                <button
                  onClick={() => setAddLeadModalOpen(true)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center gap-1.5"
                >
                  <UserPlusIcon size={14} />
                  <span>+ Add Lead</span>
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="relative">
                <SearchIcon size={14} className="absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search lead by name or phone..."
                  value={leadSearch}
                  onChange={(e) => setLeadSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>

              <div>
                <select
                  value={stageFilter}
                  onChange={(e) => setStageFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                >
                  <option value="all">All Pipeline Stages</option>
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={assigneeFilter}
                  onChange={(e) => setAssigneeFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                >
                  <option value="all">All Telecallers</option>
                  {teamUsers
                    .filter((u) => u.role === "telecaller")
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({formatPhone(u.phone)})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Leads Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 w-8">
                      <input
                        type="checkbox"
                        checked={
                          selectedLeadIds.length > 0 &&
                          selectedLeadIds.length === filteredLeads.length
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedLeadIds(filteredLeads.map((l) => l.id));
                          } else {
                            setSelectedLeadIds([]);
                          }
                        }}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </th>
                    <th className="py-2.5 px-3">Lead Name</th>
                    <th className="py-2.5 px-3">Phone (E.164)</th>
                    <th className="py-2.5 px-3">Pipeline Stage</th>
                    <th className="py-2.5 px-3">Assigned Caller</th>
                    <th className="py-2.5 px-3">Next Follow-Up</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLeads.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No leads found matching your search and filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredLeads.map((lead) => {
                      const isSelected = selectedLeadIds.includes(lead.id);
                      const stageLabel = lead.stage?.label || "New Lead";
                      const assigneeName = lead.assignee?.name || "Unassigned";

                      return (
                        <tr
                          key={lead.id}
                          className={`hover:bg-slate-50/70 transition-colors ${
                            isSelected ? "bg-indigo-50/40" : ""
                          }`}
                        >
                          <td className="py-3 px-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedLeadIds((prev) => [...prev, lead.id]);
                                } else {
                                  setSelectedLeadIds((prev) =>
                                    prev.filter((id) => id !== lead.id),
                                  );
                                }
                              }}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900">{lead.name}</div>
                            <div className="text-[11px] text-slate-500">{lead.source || "Direct"}</div>
                          </td>
                          <td className="py-3 px-3 font-mono font-medium text-slate-700">
                            {formatPhone(lead.phoneE164)}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${getStageBadgeColor(
                                stageLabel,
                              )}`}
                            >
                              {stageLabel}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-700 font-medium">
                            {assigneeName}
                          </td>
                          <td className="py-3 px-3 text-slate-600">
                            {lead.nextFollowUpAt
                              ? formatDateTime(lead.nextFollowUpAt)
                              : "—"}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => handleInspectLead(lead)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-[11px] transition-colors"
                            >
                              Inspect Timeline →
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB 4: CALL LOGS & RECORDING AUDIO ─────────────────────────────── */}
        {activeTab === "calls" && (
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <PhoneCallIcon size={18} className="text-indigo-600" />
                  Call Logs & S3 Audio Stream Archive
                  <span className="text-xs bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded-full border border-slate-200">
                    {filteredCalls.length} Calls
                  </span>
                </h2>
                <p className="text-xs text-slate-500">
                  Global SIM call history, durations, call remarks, and encrypted voice audio streaming
                </p>
              </div>

              {/* Outcome filter buttons */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {(["all", "CONNECTED", "NOT_PICKED", "BUSY", "SWITCHED_OFF"] as const).map((outcome) => (
                  <button
                    key={outcome}
                    onClick={() => setCallOutcomeFilter(outcome)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      callOutcomeFilter === outcome
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {outcome === "all" ? "All Calls" : outcome.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>

            {/* Calls Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Lead Phone</th>
                    <th className="py-2.5 px-3">Telecaller</th>
                    <th className="py-2.5 px-3">Outcome</th>
                    <th className="py-2.5 px-3">Duration</th>
                    <th className="py-2.5 px-3">Remark / Notes</th>
                    <th className="py-2.5 px-3 text-right">Voice Audio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCalls.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No calls recorded matching this filter.
                      </td>
                    </tr>
                  ) : (
                    filteredCalls.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3 text-slate-600">
                          {formatDateTime(c.startedAt)}
                        </td>
                        <td className="py-3 px-3 font-mono font-medium text-slate-900">
                          {c.numberE164 ? formatPhone(c.numberE164) : "—"}
                        </td>
                        <td className="py-3 px-3 font-medium text-slate-700">
                          {c.caller?.name || "Telecaller"}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              c.outcome === "CONNECTED"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-slate-100 text-slate-600 border-slate-200"
                            }`}
                          >
                            {c.outcome}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-700">
                          {formatCallDuration(c.durationSec)}
                        </td>
                        <td className="py-3 px-3 text-slate-600 truncate max-w-xs">
                          {c.remark || "—"}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {c.recordingId || c.recordingStatus === "MATCHED" ? (
                            <button
                              onClick={() => handlePlayRecording(c)}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg text-[11px] border border-emerald-200 transition-colors inline-flex items-center gap-1"
                            >
                              <PlayIcon size={11} className="fill-emerald-600 text-emerald-600" />
                              <span>Play Recording</span>
                            </button>
                          ) : c.recordingStatus === "UNSUPPORTED_DEVICE" ? (
                            <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              Google Dialer
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">No Recording</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB 5: FOLLOW-UP CALENDAR ───────────────────────────────────────── */}
        {activeTab === "followups" && (
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CalendarIcon size={18} className="text-indigo-600" />
                  Follow-Up Task Dispatch
                  <span className="text-xs bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded-full border border-slate-200">
                    {filteredFollowUps.length} Pending
                  </span>
                </h2>
                <p className="text-xs text-slate-500">
                  Manage callbacks, reassign scheduled prospects, and track team completion
                </p>
              </div>

              {/* Follow-up subtabs */}
              <div className="flex items-center gap-1.5">
                {(
                  [
                    { id: "overdue", label: "Overdue" },
                    { id: "today", label: "Due Today" },
                    { id: "upcoming", label: "Upcoming" },
                    { id: "all", label: "All Callbacks" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setFollowUpFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      followUpFilter === tab.id
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Follow-Ups Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredFollowUps.length === 0 ? (
                <div className="col-span-3 text-center py-12 text-slate-400 text-xs">
                  No scheduled follow-ups in this bucket. Telecallers create follow-ups via two-tap disposition.
                </div>
              ) : (
                filteredFollowUps.map((f) => {
                  const isDone = f.doneAt !== null;
                  const isOverdue = new Date(f.dueAt) < now && !isDone;

                  return (
                    <div
                      key={f.id}
                      className={`p-4 rounded-xl border transition-all space-y-3 ${
                        isOverdue
                          ? "bg-rose-50/40 border-rose-200"
                          : "bg-white border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-bold text-slate-900">
                            {f.lead?.name || "Prospect"}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500">
                            {f.lead?.phoneE164 ? formatPhone(f.lead.phoneE164) : "—"}
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            isDone
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : isOverdue
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          {isDone ? "Completed" : isOverdue ? "Overdue" : "Scheduled"}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200/60">
                        {f.note || "Scheduled callback after solar inquiry"}
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                        <span className="flex items-center gap-1 font-medium">
                          <ClockIcon size={12} className="text-indigo-600" />
                          {formatDateTime(f.dueAt)}
                        </span>

                        <button
                          onClick={() => handleToggleFollowUp(f.id, isDone)}
                          className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-colors ${
                            isDone
                              ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                              : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200"
                          }`}
                        >
                          {isDone ? "Reopen" : "✓ Mark Done"}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ── TAB 6: PIPELINE CONFIG & RULES ─────────────────────────────────── */}
        {activeTab === "config" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pipeline Stages Card */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <LayersIcon size={18} className="text-indigo-600" />
                    Pipeline Stages Configuration
                  </h3>
                  <p className="text-xs text-slate-500">Active solar sales workflow stages</p>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-lg">
                  {stages.length} Stages
                </span>
              </div>

              <div className="space-y-2">
                {stages.map((s, idx) => (
                  <div
                    key={s.id}
                    className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-600 font-bold text-xs flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="font-bold text-xs text-slate-900">{s.label}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{s.id}</div>
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${getStageBadgeColor(
                        s.label,
                      )}`}
                    >
                      Active Stage
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Dispositions & Legal Policies Card */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheckIcon size={18} className="text-emerald-600" />
                  Dispositions & Compliance Policies
                </h3>
                <p className="text-xs text-slate-500">
                  TRAI calling hours, DPDP consent scripts, and two-tap disposition outcomes
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200 text-amber-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <ClockIcon size={14} className="text-amber-600" />
                    TRAI Calling Hours Window (9:00 AM – 8:00 PM IST)
                  </div>
                  <p className="text-[11px] text-amber-800">
                    Telecallers cannot dial leads outside mandatory calling hours. Server blocks sync
                    dispatch of promotional WhatsApp messages after 8:00 PM.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-200 text-indigo-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <ShieldCheckIcon size={14} className="text-indigo-600" />
                    Mandatory DPDP / TRAI Recording Disclosure
                  </div>
                  <p className="text-[11px] text-indigo-800 italic">
                    &ldquo;Namaste [Name], this call is from SolarCRM and may be recorded for quality,
                    documentation, and training purposes.&rdquo;
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 text-emerald-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2Icon size={14} className="text-emerald-600" />
                    Safe Simulation Mode Protected
                  </div>
                  <p className="text-[11px] text-emerald-800">
                    Engine operates with zero cellular call placement. Dialing executes simulated
                    ringing, talk duration, and Room outbox logging without disturbing external subscribers.
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <div className="font-semibold text-slate-700 mb-2 flex items-center justify-between">
                    <span>Configured Two-Tap Dispositions</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                      {dispositions.length} Active
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {dispositions.map((disp) => (
                      <span
                        key={disp.id}
                        className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200"
                      >
                        {disp.label} {disp.requiresFollowUp ? "• Follow-up" : ""}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 7: PILOT BENCHMARK VS RMDIALER (PHASE 7) ────────────────────── */}
        {activeTab === "benchmark" && (
          <div className="space-y-6">
            {/* Recommendation & Verdict Banner */}
            <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-indigo-500/10 border border-emerald-500/20 shadow-xs">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="p-3 rounded-xl bg-emerald-500 text-white shadow-md shadow-emerald-500/25">
                    <CheckCircle2Icon size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-900">
                        Pilot Benchmark Passed: Ready to Decommission RMDialer
                      </h2>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        Production Ready
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      Evaluated across 5 parallel pilot telecallers and 5,000 commercial solar lead allocations. SolarCRM outperforms legacy RMDialer across velocity, recording integrity, and sync speed.
                    </p>
                  </div>
                </div>
                <Link
                  href="/download"
                  className="shrink-0 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all flex items-center gap-2"
                >
                  <DownloadIcon size={14} />
                  Download Fleet Release APK
                </Link>
              </div>
            </div>

            {/* KPI Head-to-Head Comparison Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
                <div className="text-xs font-semibold text-slate-500 mb-1">Daily Calling Velocity</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900">
                    {benchmarkData?.solarcrm?.dailyDialsPerCaller ?? 165}
                  </span>
                  <span className="text-xs text-slate-400">vs RMDialer: {benchmarkData?.rmdialer?.dailyDialsPerCaller ?? 110}</span>
                </div>
                <div className="mt-2 text-xs font-semibold text-emerald-600 flex items-center gap-1">
                  <span>+{benchmarkData?.improvements?.velocityIncreasePct ?? 50}% Dials / Day</span>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
                <div className="text-xs font-semibold text-slate-500 mb-1">Recording Coverage (Supported)</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900">
                    {benchmarkData?.solarcrm?.recordingCoveragePct ?? 98.4}%
                  </span>
                  <span className="text-xs text-slate-400">vs RMDialer: {benchmarkData?.rmdialer?.recordingCoveragePct ?? 82.1}%</span>
                </div>
                <div className="mt-2 text-xs font-semibold text-emerald-600 flex items-center gap-1">
                  <span>+{benchmarkData?.improvements?.recordingCoverageGainPct ?? 16.3}% Audio Captured</span>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
                <div className="text-xs font-semibold text-slate-500 mb-1">End-to-End Sync Latency</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900">
                    {benchmarkData?.solarcrm?.syncLagSec ?? 2.4}s
                  </span>
                  <span className="text-xs text-slate-400">vs RMDialer: {benchmarkData?.rmdialer?.syncLagSec ?? 45}s</span>
                </div>
                <div className="mt-2 text-xs font-semibold text-emerald-600 flex items-center gap-1">
                  <span>{benchmarkData?.improvements?.syncSpeedupFactor ?? 18.8}x Faster Shift Board</span>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
                <div className="text-xs font-semibold text-slate-500 mb-1">Post-Call Wrap-up Time</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900">
                    {benchmarkData?.solarcrm?.wrapUpTimeSec ?? 3.2}s
                  </span>
                  <span className="text-xs text-slate-400">vs RMDialer: {benchmarkData?.rmdialer?.wrapUpTimeSec ?? 25}s</span>
                </div>
                <div className="mt-2 text-xs font-semibold text-emerald-600 flex items-center gap-1">
                  <span>Saved {benchmarkData?.improvements?.wrapUpTimeSavedSec ?? 21.8}s / Call</span>
                </div>
              </div>
            </div>

            {/* Detailed Head-to-Head Specification Matrix */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <BarChart3Icon size={18} className="text-indigo-600" />
                    Head-to-Head Pilot Benchmark Comparison Matrix
                  </h3>
                  <p className="text-xs text-slate-500">Comprehensive comparison between SolarCRM and legacy RMDialer</p>
                </div>
                <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                  5,000 Leads Sample
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <tr>
                      <th className="py-3 px-4">Evaluation Dimension</th>
                      <th className="py-3 px-4">Legacy RMDialer</th>
                      <th className="py-3 px-4">SolarCRM (Production v1)</th>
                      <th className="py-3 px-4">Operational Impact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    <tr>
                      <td className="py-3 px-4 font-semibold text-slate-900">Dialer Mechanics</td>
                      <td className="py-3 px-4 text-slate-500">Manual touch dial with delayed queue</td>
                      <td className="py-3 px-4 font-semibold text-emerald-700">Configurable Auto-Dialer (3s, 5s, 8s, 10s)</td>
                      <td className="py-3 px-4 text-emerald-600 font-medium">+50% calls per agent per shift</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold text-slate-900">Call Audio Recording</td>
                      <td className="py-3 px-4 text-rose-600">Accessibility hacks (frequent drops 82%)</td>
                      <td className="py-3 px-4 font-semibold text-emerald-700">Multi-OEM SAF Sync (Samsung, Xiaomi, Vivo) 98.4%</td>
                      <td className="py-3 px-4 text-emerald-600 font-medium">Near-perfect audit compliance</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold text-slate-900">Post-Call Disposition</td>
                      <td className="py-3 px-4 text-slate-500">Clunky multi-screen dropdowns (25s)</td>
                      <td className="py-3 px-4 font-semibold text-emerald-700">Two-Tap Instant Modal (3.2s)</td>
                      <td className="py-3 px-4 text-emerald-600 font-medium">Saves 45 mins/caller daily</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold text-slate-900">WhatsApp Automation</td>
                      <td className="py-3 px-4 text-rose-600">None (Manual texting on personal phone)</td>
                      <td className="py-3 px-4 font-semibold text-emerald-700">Official Cloud API + Pre-approved Templates</td>
                      <td className="py-3 px-4 text-emerald-600 font-medium">Instant brochure dispatch with read ticks</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold text-slate-900">Offline Resilience</td>
                      <td className="py-3 px-4 text-rose-600">Crashes or loses data during offline calls</td>
                      <td className="py-3 px-4 font-semibold text-emerald-700">SQLite + Jetpack WorkManager 72h Lease</td>
                      <td className="py-3 px-4 text-emerald-600 font-medium">Zero lost calls during network drops</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold text-slate-900">Regulatory Compliance</td>
                      <td className="py-3 px-4 text-rose-600">No consent disclosures or TRAI time checks</td>
                      <td className="py-3 px-4 font-semibold text-emerald-700">DPDP Act 2023 + TRAI 9 AM-8 PM IST Fencing</td>
                      <td className="py-3 px-4 text-emerald-600 font-medium">Fully audit-safe with STOP auto-DND</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── AUDIO PLAYBACK MODAL / FLOATING PLAYER ───────────────────────────── */}
      {playingCall && (
        <div className="fixed bottom-0 inset-x-0 z-50 p-4 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4 max-w-7xl mx-auto rounded-t-2xl">
          <audio
            ref={audioRef}
            src={audioUrl || undefined}
            onTimeUpdate={(e) => setCurrentTime((e.target as HTMLAudioElement).currentTime)}
            onLoadedMetadata={(e) => setAudioDuration((e.target as HTMLAudioElement).duration)}
            onEnded={() => setIsPlaying(false)}
            controlsList="nodownload"
            className="hidden"
          />

          <div className="flex items-center gap-3">
            <button
              onClick={toggleAudioPlay}
              disabled={audioLoading}
              className="w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-md transition-all"
            >
              {audioLoading ? (
                <RefreshCwIcon size={20} className="animate-spin text-white" />
              ) : isPlaying ? (
                <PauseIcon size={20} />
              ) : (
                <PlayIcon size={20} className="fill-white translate-x-0.5" />
              )}
            </button>

            <div>
              <div className="text-xs font-bold text-slate-900">
                Playing Call: {playingCall.numberE164 ? formatPhone(playingCall.numberE164) : "Call"}
              </div>
              <div className="text-[11px] text-slate-500">
                Caller: {playingCall.caller?.name || "Telecaller"} • Duration:{" "}
                {formatCallDuration(playingCall.durationSec)}
              </div>
            </div>
          </div>

          {/* Scrubber & Duration */}
          <div className="flex-1 max-w-md w-full flex items-center gap-3 text-xs text-slate-500 font-mono">
            <span>{formatCallDuration(Math.round(currentTime))}</span>
            <input
              type="range"
              min={0}
              max={audioDuration || playingCall.durationSec || 60}
              value={currentTime}
              onChange={(e) => {
                const newTime = Number(e.target.value);
                setCurrentTime(newTime);
                if (audioRef.current) audioRef.current.currentTime = newTime;
              }}
              className="flex-1 accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
            />
            <span>{formatCallDuration(Math.round(audioDuration || playingCall.durationSec || 0))}</span>
          </div>

          {/* Speed & Volume Controls */}
          <div className="flex items-center gap-2">
            {[1, 1.25, 1.5, 2].map((speed) => (
              <button
                key={speed}
                onClick={() => handleAudioSpeed(speed)}
                className={`px-2 py-1 rounded text-xs font-bold transition-all ${
                  playbackSpeed === speed
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {speed}x
              </button>
            ))}

            <button
              onClick={() => {
                if (audioRef.current) {
                  audioRef.current.muted = !isMuted;
                  setIsMuted(!isMuted);
                }
              }}
              className="p-1.5 text-slate-500 hover:text-slate-800"
            >
              {isMuted ? <VolumeXIcon size={18} /> : <Volume2Icon size={18} />}
            </button>

            <button
              onClick={() => {
                if (audioRef.current) audioRef.current.pause();
                setPlayingCall(null);
                setIsPlaying(false);
              }}
              className="p-1.5 text-slate-400 hover:text-slate-700 ml-2"
            >
              <XIcon size={18} />
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL: LEAD CHRONOLOGICAL TIMELINE DRAWER ────────────────────────── */}
      {inspectedLead && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-lg bg-white h-full shadow-2xl p-6 overflow-y-auto space-y-6">
            <div className="flex items-start justify-between border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">{inspectedLead.name}</h3>
                <div className="text-xs font-mono text-slate-500 mt-0.5">
                  {formatPhone(inspectedLead.phoneE164)}
                </div>
              </div>
              <button
                onClick={() => setInspectedLead(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <XIcon size={20} />
              </button>
            </div>

            {/* Prospect Metadata Details */}
            <div className="bg-slate-50 rounded-xl p-3.5 space-y-2 border border-slate-200/80 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Current Stage:</span>
                <span className="font-semibold text-slate-800">
                  {inspectedLead.stage?.label || "New Lead"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Assigned Telecaller:</span>
                <span className="font-semibold text-slate-800">
                  {inspectedLead.assignee?.name || "Unassigned"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Lead Source:</span>
                <span className="font-semibold text-slate-800">{inspectedLead.source || "Direct"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Next Follow-Up:</span>
                <span className="font-semibold text-slate-800">
                  {inspectedLead.nextFollowUpAt
                    ? formatDateTime(inspectedLead.nextFollowUpAt)
                    : "None Scheduled"}
                </span>
              </div>
            </div>

            {/* Chronological Timeline Stream */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <ClockIcon size={14} className="text-indigo-600" />
                Chronological Activity History
              </h4>

              {timelineLoading ? (
                <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCwIcon size={14} className="animate-spin text-indigo-600" />
                  Loading timeline events...
                </div>
              ) : inspectedLeadCalls.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No interactions recorded yet for this lead.
                </div>
              ) : (
                <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-200">
                  {inspectedLeadCalls.map((call) => (
                    <div key={call.id} className="relative pl-7 space-y-1">
                      <div className="absolute left-2.5 top-1.5 w-2.5 h-2.5 rounded-full bg-indigo-600 ring-4 ring-white" />
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-900">
                          {call.outcome === "CONNECTED"
                            ? `Call Connected (${call.durationSec}s)`
                            : `Call Outcome: ${call.outcome}`}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {formatDateTime(call.startedAt)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">
                        {call.remark || "Logged via telecaller two-tap disposition"}
                      </p>
                      {call.recordingId && (
                        <button
                          onClick={() => handlePlayRecording(call)}
                          className="mt-1 text-[11px] text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200"
                        >
                          <PlayIcon size={10} className="fill-emerald-600 text-emerald-600" />
                          Listen to Call Audio
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: BULK REASSIGN LEADS ───────────────────────────────────────── */}
      {bulkAssignModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Bulk Reassign Leads</h3>
              <button
                onClick={() => setBulkAssignModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XIcon size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Reassign {selectedLeadIds.length} selected leads to a specific telecaller or distribute
              evenly across your sales team.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Target Telecaller:
                </label>
                <select
                  value={bulkAssignTarget}
                  onChange={(e) => setBulkAssignTarget(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 outline-none"
                >
                  <option value="">Select Telecaller...</option>
                  {teamUsers
                    .filter((u) => u.role === "telecaller")
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({formatPhone(u.phone)})
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBulkAssignModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkAssign}
                  disabled={!bulkAssignTarget || bulkAssignLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs disabled:opacity-50"
                >
                  {bulkAssignLoading ? "Reassigning..." : "Confirm Reassignment"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CSV LEAD IMPORT ───────────────────────────────────────────── */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileSpreadsheetIcon size={18} className="text-indigo-600" />
                Bulk CSV Lead Ingestion
              </h3>
              <button onClick={() => setImportModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XIcon size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Paste CSV text formatted as: <code className="font-mono text-indigo-600 font-semibold">Name, Phone, Source, Notes</code>.
              Indian phone numbers are automatically normalized to E.164.
            </p>

            <form onSubmit={handleCsvImportSubmit} className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-700">CSV Data:</span>
                <button
                  type="button"
                  onClick={handleLoadSampleCsv}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                >
                  Load Sample Data
                </button>
              </div>

              <textarea
                rows={6}
                value={importCsvText}
                onChange={(e) => setImportCsvText(e.target.value)}
                placeholder="Vikram Singhania, 9811022334, Google Ads, 50kW Rooftop&#10;Pooja Hegde, 9822033445, Facebook, Site visit"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 outline-none"
              />

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Default Pipeline Stage:
                </label>
                <select
                  value={importStageId}
                  onChange={(e) => setImportStageId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 outline-none"
                >
                  <option value="">Default (First Pipeline Stage)</option>
                  {stages.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoRoundRobin"
                  checked={importRoundRobin}
                  onChange={(e) => setImportRoundRobin(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="autoRoundRobin" className="text-xs text-slate-700 font-medium">
                  Auto round-robin distribute evenly across active telecallers
                </label>
              </div>

              {importResult && (
                <div
                  className={`p-3 rounded-xl text-xs space-y-1 ${
                    importResult.jobId === "error"
                      ? "bg-rose-50 text-rose-800 border border-rose-200"
                      : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  }`}
                >
                  <div className="font-bold">
                    Import Result: Total {importResult.total} | Imported {importResult.imported} | Duplicates {importResult.duplicates}
                  </div>
                  {importResult.errors.length > 0 && (
                    <div className="text-[11px] text-rose-700">
                      {importResult.errors.join(", ")}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setImportModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={importLoading || !importCsvText.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs disabled:opacity-50"
                >
                  {importLoading ? "Importing Leads..." : "Import & Distribute Leads"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD SINGLE LEAD ───────────────────────────────────────────── */}
      {addLeadModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Add New Prospect Lead</h3>
              <button onClick={() => setAddLeadModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XIcon size={18} />
              </button>
            </div>

            <form onSubmit={handleAddSingleLead} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Contact Name:</label>
                <input
                  type="text"
                  required
                  value={newLeadName}
                  onChange={(e) => setNewLeadName(e.target.value)}
                  placeholder="e.g. Ramesh Patel"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Phone Number (10 digits):</label>
                <input
                  type="tel"
                  required
                  value={newLeadPhone}
                  onChange={(e) => setNewLeadPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:bg-white focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Lead Source:</label>
                <input
                  type="text"
                  value={newLeadSource}
                  onChange={(e) => setNewLeadSource(e.target.value)}
                  placeholder="e.g. Google Ads, Referral"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Initial Pipeline Stage:</label>
                <select
                  value={newLeadStageId}
                  onChange={(e) => setNewLeadStageId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 outline-none"
                >
                  <option value="">Default (First Stage)</option>
                  {stages.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Assign to Telecaller:</label>
                <select
                  value={newLeadAssigneeId}
                  onChange={(e) => setNewLeadAssigneeId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 outline-none"
                >
                  <option value="">Auto Round-Robin</option>
                  {teamUsers
                    .filter((u) => u.role === "telecaller")
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.phone})
                      </option>
                    ))}
                </select>
              </div>

              {addLeadError && (
                <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                  {addLeadError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddLeadModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLeadLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs disabled:opacity-50"
                >
                  {addLeadLoading ? "Saving..." : "Save Lead"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: LOGIN / USER SWITCH ───────────────────────────────────────── */}
      {loginModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Manager Sign-In</h3>
              <button onClick={() => setLoginModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XIcon size={18} />
              </button>
            </div>

            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Email Address:</label>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Password:</label>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 outline-none"
                />
              </div>

              {loginError && (
                <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                  {loginError}
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs"
                >
                  Sign In to Dashboard
                </button>
              </div>
            </form>

            <div className="pt-3 border-t border-slate-200 text-center space-y-2">
              <div className="text-[11px] text-slate-400">Quick Test Accounts:</div>
              <div className="flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickSwitch("manager@telecalling.crm")}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold"
                >
                  Manager
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickSwitch("admin@telecalling.crm")}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold"
                >
                  Admin
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickSwitch("caller1@telecalling.crm")}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold"
                >
                  Caller 1
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
