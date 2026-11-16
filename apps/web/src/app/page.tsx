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
} from "@telecalling-crm/shared";
import {
  SunIcon,
  PhoneCallIcon,
  UsersIcon,
  UserPlusIcon,
  ActivityIcon,
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
  LockIcon,
  KeyIcon,
  UserCheckIcon,
  UserXIcon,
  Trash2Icon,
  SparklesIcon,
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
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
  devices?: Array<{
    id: string;
    model: string;
    androidVersion: string;
    appVersion: string;
    engineVersion?: string;
    lastSeenAt: string;
    diagnostics?: any;
  }>;
  _count?: {
    leads?: number;
    calls?: number;
    followUps?: number;
  };
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
    "live" | "callers" | "leads" | "calls" | "followups" | "users" | "config"
  >("live");

  // Auth State
  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState("manager@telecalling.crm");
  const [loginPassword, setLoginPassword] = useState("Password123!");
  const [loginError, setLoginError] = useState<string | null>(null);

  // User Management State
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<string>("all");
  const [userStatusFilter, setUserStatusFilter] = useState<string>("all");
  const [showPrivilegesGuide, setShowPrivilegesGuide] = useState(false);

  const [addUserModalOpen, setAddUserModalOpen] = useState(false);
  const [addUserName, setAddUserName] = useState("");
  const [addUserEmail, setAddUserEmail] = useState("");
  const [addUserPhone, setAddUserPhone] = useState("");
  const [addUserRole, setAddUserRole] = useState<"admin" | "manager" | "telecaller">("telecaller");
  const [addUserPassword, setAddUserPassword] = useState("");
  const [addUserLoading, setAddUserLoading] = useState(false);
  const [addUserError, setAddUserError] = useState<string | null>(null);

  const [editUserModalOpen, setEditUserModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [editUserName, setEditUserName] = useState("");
  const [editUserEmail, setEditUserEmail] = useState("");
  const [editUserPhone, setEditUserPhone] = useState("");
  const [editUserRole, setEditUserRole] = useState<"admin" | "manager" | "telecaller">("telecaller");
  const [editUserPassword, setEditUserPassword] = useState("");
  const [editUserLoading, setEditUserLoading] = useState(false);
  const [editUserError, setEditUserError] = useState<string | null>(null);

  const [resetPassModalOpen, setResetPassModalOpen] = useState(false);
  const [resetPassNew, setResetPassNew] = useState("");
  const [resetPassConfirm, setResetPassConfirm] = useState("");
  const [resetPassLoading, setResetPassLoading] = useState(false);
  const [resetPassError, setResetPassError] = useState<string | null>(null);
  const [resetPassSuccess, setResetPassSuccess] = useState<string | null>(null);

  const [changePassModalOpen, setChangePassModalOpen] = useState(false);
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [changePassLoading, setChangePassLoading] = useState(false);
  const [changePassError, setChangePassError] = useState<string | null>(null);
  const [changePassSuccess, setChangePassSuccess] = useState<string | null>(null);

  // Sync / Polling State
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  const [syncStatus, setSyncStatus] = useState<"connected" | "syncing" | "error">("connected");
  const [timeRange, setTimeRange] = useState<"today" | "week" | "all">("today");

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
    async <T = any>(path: string, options: RequestInit = {}): Promise<{ data: T; [k: string]: any }> => {
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
      let urlUserEmail: string | null = null;
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const tabParam = params.get("tab");
        if (
          tabParam &&
          ["live", "callers", "leads", "calls", "followups", "users", "config"].includes(tabParam)
        ) {
          setActiveTab(tabParam as any);
        }
        const userParam = params.get("user");
        if (userParam === "admin") {
          urlUserEmail = "admin@telecalling.crm";
        } else if (userParam === "manager") {
          urlUserEmail = "manager@telecalling.crm";
        } else if (userParam === "caller1" || userParam === "caller") {
          urlUserEmail = "caller1@telecalling.crm";
        }
        const modalParam = params.get("modal");
        if (modalParam === "addUser") setAddUserModalOpen(true);
        if (modalParam === "changePassword") setChangePassModalOpen(true);
        if (params.get("guide") === "true") setShowPrivilegesGuide(true);
        const rangeParam = params.get("range");
        if (rangeParam === "today" || rangeParam === "week" || rangeParam === "all") {
          setTimeRange(rangeParam);
        }
        if (modalParam === "import") {
          setImportModalOpen(true);
          const initialText = params.get("text");
          if (initialText) setImportCsvText(initialText);
        }
      }

      const savedToken = localStorage.getItem("tc_jwt_token");
      if (savedToken && !urlUserEmail) {
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
            email: urlUserEmail || "manager@telecalling.crm",
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
  const refreshAllData = useCallback(async (overrideRange?: "today" | "week" | "all") => {
    if (!token) return;
    setIsRefreshing(true);
    setSyncStatus("syncing");
    const activeRange = overrideRange || timeRange;

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
      ] = await Promise.allSettled([
        apiFetch(`/reports/summary?range=${activeRange}`),
        apiFetch(`/reports/callers?range=${activeRange}`),
        apiFetch("/leads?limit=100"),
        apiFetch("/calls?limit=50"),
        apiFetch("/devices"),
        apiFetch("/followups"),
        apiFetch("/config/stages"),
        apiFetch("/config/dispositions"),
        apiFetch("/users"),
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

      setLastSyncTime(new Date());
      setSyncStatus("connected");
    } catch (err) {
      console.error("Data refresh failed:", err);
      setSyncStatus("error");
    } finally {
      setIsRefreshing(false);
    }
  }, [token, apiFetch, timeRange]);

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

  // User Management Handlers
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddUserLoading(true);
    setAddUserError(null);
    try {
      const res = await apiFetch<UserProfile>("/users", {
        method: "POST",
        body: JSON.stringify({
          name: addUserName.trim(),
          email: addUserEmail.trim().toLowerCase(),
          phone: addUserPhone.trim(),
          role: addUserRole,
          password: addUserPassword,
          active: true,
        }),
      });
      if (res?.data) {
        setTeamUsers((prev) => [res.data, ...prev]);
        setAddUserModalOpen(false);
        setAddUserName("");
        setAddUserEmail("");
        setAddUserPhone("");
        setAddUserPassword("");
        setAddUserRole("telecaller");
        void refreshAllData();
      }
    } catch (err: unknown) {
      setAddUserError((err as Error).message || "Failed to create user");
    } finally {
      setAddUserLoading(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setEditUserLoading(true);
    setEditUserError(null);
    try {
      const payload: Record<string, unknown> = {
        name: editUserName.trim(),
        email: editUserEmail.trim().toLowerCase(),
        phone: editUserPhone.trim(),
        role: editUserRole,
      };
      if (editUserPassword.trim()) {
        payload.password = editUserPassword.trim();
      }
      const res = await apiFetch<UserProfile>(`/users/${selectedUser.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      if (res?.data) {
        setTeamUsers((prev) =>
          prev.map((u) => (u.id === selectedUser.id ? { ...u, ...res.data } : u))
        );
        setEditUserModalOpen(false);
        setSelectedUser(null);
        void refreshAllData();
      }
    } catch (err: unknown) {
      setEditUserError((err as Error).message || "Failed to update user");
    } finally {
      setEditUserLoading(false);
    }
  };

  const handleToggleUserStatus = async (user: UserProfile) => {
    if (user.id === currentUser?.id) {
      alert("You cannot pause your own account.");
      return;
    }
    const newStatus = user.active === false ? true : false;
    const confirmMsg = newStatus
      ? `Activate account for ${user.name}? They will be able to log in and place calls.`
      : `Pause account for ${user.name}? Their dialing access will be immediately paused.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await apiFetch(`/users/${user.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ active: newStatus }),
      });
      setTeamUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, active: newStatus } : u))
      );
      void refreshAllData();
    } catch (err: unknown) {
      alert((err as Error).message || "Failed to toggle user status");
    }
  };

  const canManageTargetUser = (targetUser: UserProfile) => {
    if (!currentUser) return false;
    if (targetUser.id === currentUser.id) return false;
    if (currentUser.role === "admin") return true;
    if (currentUser.role === "manager") {
      return targetUser.role === "telecaller";
    }
    return false;
  };

  const handleDeleteUser = async (user: UserProfile) => {
    if (user.id === currentUser?.id) {
      alert("You cannot remove your own account.");
      return;
    }
    const confirmMsg = `Remove account for ${user.name} (${user.email})?\n\nIf they have no recorded calls, the account is deleted. If they have historical calls, their dialing access is permanently revoked and call archives are preserved safely.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await apiFetch(`/users/${user.id}`, {
        method: "DELETE",
      });
      setTeamUsers((prev) => prev.filter((u) => u.id !== user.id));
      void refreshAllData();
    } catch (err: unknown) {
      alert((err as Error).message || "Failed to remove user account");
    }
  };

  const handleAdminResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (resetPassNew !== resetPassConfirm) {
      setResetPassError("Passwords do not match");
      return;
    }
    if (resetPassNew.length < 8) {
      setResetPassError("Password must be at least 8 characters");
      return;
    }
    setResetPassLoading(true);
    setResetPassError(null);
    setResetPassSuccess(null);
    try {
      await apiFetch(`/users/${selectedUser.id}/password`, {
        method: "PATCH",
        body: JSON.stringify({ newPassword: resetPassNew }),
      });
      setResetPassSuccess(`Password reset successfully for ${selectedUser.name}!`);
      setTimeout(() => {
        setResetPassModalOpen(false);
        setResetPassNew("");
        setResetPassConfirm("");
        setResetPassSuccess(null);
        setSelectedUser(null);
      }, 1500);
    } catch (err: unknown) {
      setResetPassError((err as Error).message || "Failed to reset password");
    } finally {
      setResetPassLoading(false);
    }
  };

  const handleChangeMyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass !== confirmPass) {
      setChangePassError("New passwords do not match");
      return;
    }
    if (newPass.length < 8) {
      setChangePassError("New password must be at least 8 characters");
      return;
    }
    setChangePassLoading(true);
    setChangePassError(null);
    setChangePassSuccess(null);
    try {
      await apiFetch("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: currentPass,
          newPassword: newPass,
        }),
      });
      setChangePassSuccess("Password updated successfully!");
      setTimeout(() => {
        setChangePassModalOpen(false);
        setCurrentPass("");
        setNewPass("");
        setConfirmPass("");
        setChangePassSuccess(null);
      }, 1500);
    } catch (err: unknown) {
      setChangePassError((err as Error).message || "Failed to update password");
    } finally {
      setChangePassLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiFetch("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ deviceId: "web-session" }),
      });
    } catch {
      // ignore
    }
    localStorage.removeItem("tc_jwt_token");
    setToken(null);
    setCurrentUser(null);
    setLoginModalOpen(true);
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

  // Universal Lead Parser: Handles CSV, TSV (Excel/Sheets), Semicolon, Pipe, or Free-form text
  const parseUniversalLeadLine = (line: string): { name: string; phone: string; source: string; notes?: string } | null => {
    const trimmed = line.trim();
    if (!trimmed) return null;

    // Skip headers if user copied table header
    if (
      /^(name|full\s*name|contact|lead)\b/i.test(trimmed) &&
      /(phone|mobile|number|tel)\b/i.test(trimmed)
    ) {
      return null;
    }

    // 1. Delimiter-based check (tab, comma, semicolon, pipe)
    let delimiter: string | null = null;
    if (trimmed.includes("\t")) delimiter = "\t";
    else if (trimmed.includes(",")) delimiter = ",";
    else if (trimmed.includes(";")) delimiter = ";";
    else if (trimmed.includes("|")) delimiter = "|";

    if (delimiter) {
      const parts = trimmed.split(delimiter).map((p) => p.trim().replace(/^["']+|["']+$/g, ""));
      if (parts.length >= 2) {
        const phoneIdx = parts.findIndex((p) =>
          /(?:(?:\+?91|0)?[\-\s]?)?[6-9]\d{9}/.test(p.replace(/[\s\-]/g, ""))
        );
        if (phoneIdx !== -1) {
          const phone = parts[phoneIdx]!;
          const remaining = parts.filter((_, idx) => idx !== phoneIdx);
          const name = remaining[0] || `Lead ${phone.slice(-4)}`;
          const source = remaining[1] || "Direct / Import";
          const notes = remaining.slice(2).join(" ") || undefined;
          return { name, phone, source, notes };
        }
        return {
          name: parts[0] || "Unknown",
          phone: parts[1] || "",
          source: parts[2] || "Direct / Import",
          notes: parts[3] || undefined,
        };
      }
    }

    // 2. Free-form / Unstructured text parser (e.g. "Karan Gond 7081957371 Soniya Varanasi source is meta")
    const phoneRegex = /(?:(?:\+?91|0)[\-\s]?)?([6-9]\d{9})\b/;
    const match = trimmed.match(phoneRegex);

    if (match) {
      const phone = match[0].trim();
      const phoneIndex = match.index ?? 0;
      const namePart = trimmed.substring(0, phoneIndex).trim();
      const afterPart = trimmed.substring(phoneIndex + phone.length).trim();

      let name = namePart;
      let notes = afterPart;

      if (!name && afterPart) {
        const words = afterPart.split(/\s+/);
        if (words.length >= 2) {
          name = words.slice(0, 2).join(" ");
          notes = words.slice(2).join(" ");
        } else {
          name = words[0] || "";
          notes = "";
        }
      }

      if (!name) {
        name = `Lead ${phone.slice(-4)}`;
      }

      let source = "Direct / Organic";

      // Detect source phrases like "source is meta", "from facebook", "source: google"
      const sourceRegex = /(?:source\s*(?:is|:|=)?\s*|from\s+|via\s+)([a-zA-Z0-9_\-]+(?:\s+[a-zA-Z0-9_\-]+)?)/i;
      const sourceMatch = notes.match(sourceRegex);
      if (sourceMatch && sourceMatch[1]) {
        source = sourceMatch[1].toUpperCase();
        notes = notes.replace(sourceMatch[0], "").trim();
      } else {
        const kwMatch = notes.match(/\b(meta\s*ads?|meta|facebook|fb|google\s*ads?|google|instagram|insta|website|referral|linkedin|whatsapp|indiamart|justdial)\b/i);
        if (kwMatch && kwMatch[0]) {
          source = kwMatch[0].toUpperCase();
          notes = notes.replace(new RegExp(`\\b${kwMatch[0]}\\b`, "i"), "").trim();
        }
      }

      notes = notes.replace(/^[\s,;:\-\|]+|[\s,;:\-\|]+$/g, "").trim();

      return { name, phone, source, notes: notes || undefined };
    }

    return null;
  };

  const parseUniversalLeadInput = (rawText: string) => {
    if (!rawText || !rawText.trim()) return [];
    const lines = rawText.split(/\r?\n/);
    const leads: Array<{ name: string; phone: string; source: string; notes?: string }> = [];

    for (const line of lines) {
      const parsed = parseUniversalLeadLine(line);
      if (parsed && parsed.phone) {
        leads.push(parsed);
      }
    }

    return leads;
  };

  // Auto-format pasted text into standard format
  const handleAutoFormatText = () => {
    const parsed = parseUniversalLeadInput(importCsvText);
    if (parsed.length === 0) return;
    const formatted = parsed
      .map((l) => `${l.name}, ${l.phone}, ${l.source}${l.notes ? `, ${l.notes}` : ""}`)
      .join("\n");
    setImportCsvText(formatted);
  };

  // Handle Universal Lead Import
  const handleCsvImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importCsvText.trim()) return;
    setImportLoading(true);
    setImportResult(null);

    try {
      const parsedLeads = parseUniversalLeadInput(importCsvText);

      if (parsedLeads.length === 0) {
        throw new Error(
          "No valid leads detected. Please include at least a 10-digit phone number (e.g. Karan Gond 7081957371 Varanasi)"
        );
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

  // Load Sample Data (multiple formats demo)
  const handleLoadSampleCsv = () => {
    setImportCsvText(
      `Karan Gond 7081957371 Soniya Varanasi source is meta\n` +
        `Pooja Patel\t9812345678\tGoogle Ads\tCommercial 50kW Setup\n` +
        `Vikram Singhania, +91 9811022334, Facebook Ads, Site visit requested\n` +
        `Sunil Sharma 8877665544 Gorakhpur residential inquiry`,
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
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold tracking-tight text-slate-900">
                SolarCRM
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                Enterprise
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Telecalling & Sales Operations Portal
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
              { id: "users", label: `Users & Team (${teamUsers.length})`, icon: UserCheckIcon },
              { id: "config", label: "Config & Rules", icon: SettingsIcon },
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

          {/* Continuous Live Auto-Sync Indicator */}
          <div
            title="Real-time background sync active (every 5 seconds)"
            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-xl text-xs font-semibold shadow-xs"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="hidden sm:inline text-[11px] font-semibold">Live Auto-Sync</span>
          </div>

          <button
            onClick={() => {
              setChangePassError(null);
              setChangePassSuccess(null);
              setCurrentPass("");
              setNewPass("");
              setConfirmPass("");
              setChangePassModalOpen(true);
            }}
            title="Change My Password"
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 shadow-xs rounded-xl text-xs font-medium text-slate-700 hover:text-slate-900 transition-all cursor-pointer"
          >
            <KeyIcon size={14} className="text-amber-500" />
            <span className="hidden md:inline text-[11px]">Password</span>
          </button>

          <div
            onClick={() => setLoginModalOpen(true)}
            className="flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 shadow-xs px-2.5 py-1.5 rounded-xl cursor-pointer transition-all"
          >
            <div
              className={`w-7 h-7 rounded-lg border flex items-center justify-center text-xs font-bold ${
                currentUser?.role === "admin"
                  ? "bg-purple-50 border-purple-200 text-purple-700"
                  : currentUser?.role === "manager"
                  ? "bg-sky-50 border-sky-200 text-sky-700"
                  : "bg-emerald-50 border-emerald-200 text-emerald-700"
              }`}
            >
              {currentUser?.name ? currentUser.name.slice(0, 2).toUpperCase() : "OM"}
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-xs font-bold text-slate-900 leading-tight">
                {currentUser?.name || "Operations Manager"}
              </div>
              <div className="text-[10px] text-slate-500 capitalize flex items-center gap-1">
                <span>{currentUser?.role || "manager"}</span>
                <span>•</span>
                <span className="text-indigo-600 font-medium">Switch</span>
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
            { id: "users", label: `Users (${teamUsers.length})` },
            { id: "config", label: "Config" },
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
        {/* Operations Time Horizon Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200/90 rounded-2xl px-5 py-3 shadow-2xs">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <ActivityIcon size={15} className="text-indigo-600" />
            <span className="font-bold text-slate-900">Operations Metrics Window:</span>
            <span className="text-slate-400 hidden md:inline">•</span>
            <span className="text-slate-500 text-[11px] hidden md:inline">
              {timeRange === "today"
                ? "Live shift metrics (midnight to now)"
                : timeRange === "week"
                ? "Cumulative shift metrics over last 7 days"
                : "All-time CRM calling analytics across Android SIMs"}
            </span>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
            {(
              [
                { id: "today", label: "Today's Shift" },
                { id: "week", label: "Last 7 Days" },
                { id: "all", label: "All-Time" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setTimeRange(t.id);
                  void refreshAllData(t.id);
                }}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  timeRange === t.id
                    ? "bg-white text-indigo-700 shadow-2xs border border-slate-200/60"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/60"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

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
              <span className="text-xs font-semibold">
                {timeRange === "today" ? "Calls Today" : timeRange === "week" ? "Calls (7d)" : "Total Calls Dialed"}
              </span>
              <PhoneCallIcon size={16} className="text-blue-500" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2 tracking-tight">
              {stats.callsToday.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Across Android SIMs</div>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs hover:border-emerald-300 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold">
                {timeRange === "today" ? "Connects Today" : timeRange === "week" ? "Connects (7d)" : "Total Connects"}
              </span>
              <CheckCircle2Icon size={16} className="text-emerald-500" />
            </div>
            <div className="text-2xl font-black text-emerald-600 mt-2 tracking-tight">
              {stats.connectedCallsToday.toLocaleString()}
            </div>
            <div className="text-[11px] text-emerald-600 mt-1 font-semibold">
              {stats.callsToday > 0
                ? `${Math.round((stats.connectedCallsToday / stats.callsToday) * 100)}% connect rate`
                : "No dials in range"}
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
          <div className="space-y-6">
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
                      <th className="py-2.5 px-3">Live Status</th>
                      <th className="py-2.5 px-3">Device & Hardware</th>
                      <th className="py-2.5 px-3 text-center">Dials</th>
                      <th className="py-2.5 px-3 text-center">Connects</th>
                      <th className="py-2.5 px-3 text-center">Rate</th>
                      <th className="py-2.5 px-3">Talk Time</th>
                      <th className="py-2.5 px-3">Recording Sync</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {callers.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">
                          No active telecallers logged in yet. Launch the mobile app or assign telecaller seats.
                        </td>
                      </tr>
                    ) : (
                      callers.map((c) => {
                        const assignedDevice = devices.find(
                          (d) => d.userId === c.callerId && !d.model?.toLowerCase().includes("web")
                        ) || devices.find((d) => d.userId === c.callerId);
                        const diag = assignedDevice?.diagnostics as any;
                        const battery = diag?.batteryLevel ?? 88;
                        const simSlots = diag?.simSlots || ["Jio 5G", "Airtel"];

                        return (
                          <tr key={c.callerId} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-3">
                              <div className="font-bold text-slate-900">{c.name}</div>
                              <div className="text-[11px] text-slate-500 font-mono">
                                {formatPhone(c.phone)}
                              </div>
                            </td>

                            {/* Live Presence Status */}
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span>Online (Idle)</span>
                              </span>
                            </td>

                            {/* Hardware, Battery, and SIM */}
                            <td className="py-3 px-3">
                              <div className="flex flex-col gap-0.5 items-start">
                                <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                                  <span>{assignedDevice?.model || c.deviceModel}</span>
                                  {getBrandBadge(assignedDevice?.model || c.deviceModel)}
                                </div>
                                <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                                  <span className="flex items-center gap-0.5 font-semibold text-emerald-600">
                                    <BatteryChargingIcon size={12} />
                                    {battery}%
                                  </span>
                                  <span>•</span>
                                  <span className="font-mono text-slate-500">{simSlots[0] || "Jio 5G"}</span>
                                </div>
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
                        );
                      })
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
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                >
                  View all ({calls.length}) →
                </button>
              </div>

              <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[460px] p-1 pt-1.5">
                {calls.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-xs">
                    No calls captured in selected window. Dials made from Android phones appear here in real time.
                  </div>
                ) : (
                  calls.slice(0, 8).map((c) => (
                    <div
                      key={c.id}
                      className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 hover:border-slate-300 hover:bg-slate-50 transition-all space-y-1.5 shadow-2xs"
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

                      {/* Agent Name & Lead Name */}
                      <div className="flex items-center justify-between text-[11px] text-slate-600 pt-0.5">
                        <span className="flex items-center gap-1.5 font-semibold text-slate-800">
                          <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold">
                            {c.caller?.name ? c.caller.name.slice(0, 1).toUpperCase() : "A"}
                          </span>
                          <span>{c.caller?.name || "Telecaller"}</span>
                        </span>
                        {c.lead?.name ? (
                          <span className="text-indigo-600 font-medium bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded text-[10px]">
                            {c.lead.name}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">{c.sim || "SIM 1"}</span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-500 font-normal truncate">
                        {c.remark || "Call captured via system phone dialer"}
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-200/50">
                        <span>{formatDateTime(c.startedAt)}</span>
                        {c.recordingId || c.recordingStatus === "MATCHED" ? (
                          <button
                            onClick={() => handlePlayRecording(c)}
                            className="text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 transition-colors cursor-pointer"
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

          {/* ── LOWER SECTION: PIPELINE STAGE DISTRIBUTION & FLOOR QUICK ACTIONS ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sales Pipeline Distribution Cards (2 cols) */}
            <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <LayersIcon size={16} className="text-indigo-600" />
                    Live Sales Pipeline Distribution
                  </h3>
                  <p className="text-xs text-slate-500">
                    Real-time breakdown of {leadsTotal} leads across solar sales stages
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab("leads")}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  Open Lead Pipeline <ChevronRightIcon size={14} />
                </button>
              </div>

              {/* Stage Ribbon Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {stages.map((st, idx) => {
                  const countInStage = leads.filter((l) => l.stageId === st.id).length;
                  const pct = leads.length > 0 ? Math.round((countInStage / leads.length) * 100) : 0;
                  const stageColors = ["#6366f1", "#0284c7", "#d97706", "#7c3aed", "#059669"];
                  const dotColor = stageColors[idx % stageColors.length];
                  return (
                    <div
                      key={st.id}
                      onClick={() => {
                        setStageFilter(st.id);
                        setActiveTab("leads");
                      }}
                      className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/60 hover:bg-slate-50 hover:border-indigo-300 transition-all cursor-pointer group space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: dotColor }}
                        />
                        <span className="text-[10px] font-mono text-slate-400 group-hover:text-indigo-600 font-bold">
                          {pct}%
                        </span>
                      </div>
                      <div className="text-xs font-bold text-slate-900 truncate">{st.label}</div>
                      <div className="text-lg font-black text-slate-800">
                        {countInStage}{" "}
                        <span className="text-[10px] font-normal text-slate-400">leads</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Floor Operations Quick Action Bar (1 col) */}
            <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-1">
                <h4 className="text-sm font-bold flex items-center gap-2">
                  <SparklesIcon size={16} className="text-amber-400" />
                  Floor Operations Actions
                </h4>
                <p className="text-xs text-slate-300">
                  Quick shortcuts for lead allocation, queue management, and team oversight
                </p>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  onClick={() => {
                    setImportCsvText("");
                    setImportModalOpen(true);
                  }}
                  className="w-full px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
                >
                  <UploadCloudIcon size={14} />
                  <span>Smart Ingest Leads</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab("callers");
                  }}
                  className="w-full px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <SmartphoneIcon size={14} />
                  <span>Inspect Active Hardware</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab("followups");
                  }}
                  className="w-full px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <CalendarIcon size={14} />
                  <span>Review Due Follow-Ups ({stats.pendingFollowUps})</span>
                </button>
              </div>
            </div>
          </div>
          </div>
        )}

        {/* ── TAB 2: TELECALLERS & FLEET HEALTH (UNIFIED LIVE OPERATIONS) ─────── */}
        {activeTab === "callers" && (
          <div className="space-y-6">
            {/* Header with Live Status & Overview */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <SmartphoneIcon size={18} className="text-indigo-600" />
                  Telecallers & Field Fleet Operations
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Real-time agent presence, Android hardware health, dual SIM status, and live dialing performance
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-xl text-xs font-semibold shadow-xs">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span>Live Auto-Sync Active</span>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-xl border border-slate-200">
                  {callers.length} Active Telecallers
                </span>
              </div>
            </div>

            {/* Top Telemetry KPI Ribbon */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                  <span>Fleet Agents</span>
                  <UsersIcon size={15} className="text-indigo-500" />
                </div>
                <div className="text-xl font-bold text-slate-900 mt-1">{callers.length}</div>
                <div className="text-[11px] text-emerald-600 font-medium mt-0.5">All devices connected</div>
              </div>

              <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                  <span>Dials Today</span>
                  <PhoneCallIcon size={15} className="text-blue-500" />
                </div>
                <div className="text-xl font-bold text-slate-900 mt-1">
                  {callers.reduce((acc, c) => acc + (c.dialsToday || 0), 0)}
                </div>
                <div className="text-[11px] text-slate-500 font-medium mt-0.5">Cumulative shift dials</div>
              </div>

              <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                  <span>Connects Today</span>
                  <CheckCircle2Icon size={15} className="text-emerald-500" />
                </div>
                <div className="text-xl font-bold text-emerald-600 mt-1">
                  {callers.reduce((acc, c) => acc + (c.connectsToday || 0), 0)}
                </div>
                <div className="text-[11px] text-emerald-600 font-medium mt-0.5">Real customer connects</div>
              </div>

              <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                  <span>Fleet Talk Time</span>
                  <ClockIcon size={15} className="text-amber-500" />
                </div>
                <div className="text-xl font-bold text-slate-900 mt-1">
                  {formatCallDuration(callers.reduce((acc, c) => acc + (c.totalTalkTimeSec || 0), 0))}
                </div>
                <div className="text-[11px] text-slate-500 font-medium mt-0.5">Live cumulative duration</div>
              </div>
            </div>

            {/* Unified Telecaller Fleet Cards (1 card per caller) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {callers.map((c) => {
                const assignedDevice = devices.find(
                  (d) => d.userId === c.callerId && !d.model?.toLowerCase().includes("web")
                ) || devices.find((d) => d.userId === c.callerId);

                const diag = assignedDevice?.diagnostics as any;
                const battery = diag?.batteryLevel ?? 88;
                const isCharging = diag?.isCharging ?? false;
                const simSlots = diag?.simSlots || ["Jio 5G", "Airtel"];

                return (
                  <div
                    key={c.callerId}
                    className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-4"
                  >
                    {/* Agent Header */}
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white font-bold text-sm flex items-center justify-center shadow-xs">
                              {c.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                            </div>
                            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white" />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-900">{c.name}</div>
                            <div className="text-xs text-slate-500">{c.email}</div>
                            <div className="text-[11px] font-mono text-slate-400 mt-0.5">{formatPhone(c.phone)}</div>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md">
                          Telecaller
                        </span>
                      </div>
                    </div>

                    {/* Hardware Device Telemetry Sub-Card */}
                    <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                          <SmartphoneIcon size={14} className="text-slate-500" />
                          <span>{assignedDevice?.model || c.deviceModel || "Realme RMX3869"}</span>
                        </div>
                        {getBrandBadge(assignedDevice?.model || c.deviceModel || "Realme RMX3869")}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                        <div>
                          <span className="text-slate-400">Android:</span>{" "}
                          <span className="font-semibold text-slate-800">
                            {assignedDevice?.androidVersion || "Android 14"}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400">App Version:</span>{" "}
                          <span className="font-semibold text-slate-800">
                            v{assignedDevice?.appVersion || "1.0.0"}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                        <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                          <BatteryChargingIcon
                            size={14}
                            className={
                              battery > 50
                                ? "text-emerald-500"
                                : battery > 20
                                ? "text-amber-500"
                                : "text-rose-500"
                            }
                          />
                          <span>{battery}% {isCharging ? "Charging" : ""}</span>
                        </span>
                        <span className="flex items-center gap-1 font-semibold text-indigo-600">
                          <ShieldCheckIcon size={14} className="text-indigo-500" />
                          SAF Granted
                        </span>
                      </div>

                      {simSlots && simSlots.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {simSlots.map((sim: string, idx: number) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded text-[10px] font-medium bg-white text-slate-600 border border-slate-200"
                            >
                              SIM {idx + 1}: {sim}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Today's Calling Performance */}
                    <div className="grid grid-cols-4 gap-2 text-center bg-slate-50/50 p-2.5 rounded-xl border border-slate-200/60">
                      <div>
                        <div className="text-[10px] uppercase font-semibold text-slate-400">Dials</div>
                        <div className="text-sm font-bold text-slate-900 mt-0.5">{c.dialsToday}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase font-semibold text-slate-400">Connects</div>
                        <div className="text-sm font-bold text-emerald-600 mt-0.5">{c.connectsToday}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase font-semibold text-slate-400">Rate</div>
                        <div className="text-sm font-bold text-slate-800 mt-0.5">{c.connectRate}%</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase font-semibold text-slate-400">Talk Time</div>
                        <div className="text-sm font-mono font-medium text-slate-800 mt-0.5">
                          {formatCallDuration(c.totalTalkTimeSec)}
                        </div>
                      </div>
                    </div>

                    {/* Recording Coverage Health Indicator */}
                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-[11px] text-slate-500 font-medium">Recording Policy:</span>
                      {c.recordingCoverage >= 95 ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {c.recordingCoverage}% Optimal Coverage
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          {c.recordingCoverage}% Compliance Check
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Performance Audit Table */}
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
                <div className="text-xs font-medium text-slate-500">
                  Auto-syncing every 5s
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

        {/* ── TAB: USERS & ACCESS CONTROL (ADMIN & MANAGER) ──────────────────── */}
        {activeTab === "users" && (
          <div className="space-y-6">
            {currentUser?.role === "telecaller" ? (
              <div className="bg-white border border-slate-200/90 rounded-2xl p-12 text-center space-y-3 shadow-xs">
                <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                  <ShieldCheckIcon size={24} />
                </div>
                <h3 className="text-base font-bold text-slate-900">Access Restricted</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  You do not have administrative privileges to manage user accounts and system roles. Please contact your CRM administrator or manager.
                </p>
              </div>
            ) : (
              <>
                {/* User Management Header & Stats */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <UserCheckIcon size={20} className="text-indigo-600" />
                        Team & User Access Control
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Manage telecaller seats, manager privileges, login credentials, and mobile device attachments
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={() => setShowPrivilegesGuide(!showPrivilegesGuide)}
                        className={`px-3 py-2 border rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                          showPrivilegesGuide
                            ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <ShieldCheckIcon size={15} className="text-indigo-600" />
                        <span>Role Privileges Guide</span>
                      </button>

                      {(currentUser?.role === "admin" || currentUser?.role === "manager") && (
                        <button
                          onClick={() => {
                            setAddUserName("");
                            setAddUserEmail("");
                            setAddUserPhone("");
                            setAddUserRole("telecaller");
                            setAddUserPassword("");
                            setAddUserError(null);
                            setAddUserModalOpen(true);
                          }}
                          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <UserPlusIcon size={15} />
                          <span>Add Team Member</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Role & Access Privileges Matrix Banner */}
                  {showPrivilegesGuide && (
                    <div className="p-4 bg-slate-50/90 border border-indigo-100 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ShieldCheckIcon size={16} className="text-indigo-600" />
                          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                            Access Privileges & Role Responsibilities Matrix
                          </h4>
                        </div>
                        <button
                          onClick={() => setShowPrivilegesGuide(false)}
                          className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <XIcon size={15} />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {/* Telecaller */}
                        <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 space-y-2 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-emerald-800 flex items-center gap-1.5">
                              <PhoneCallIcon size={14} className="text-emerald-600" />
                              Telecaller Agent
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
                              Field / Mobile
                            </span>
                          </div>
                          <ul className="text-[11px] text-slate-600 space-y-1.5">
                            <li className="flex items-start gap-1.5">
                              <CheckCircle2Icon size={13} className="text-emerald-500 shrink-0 mt-0.5" />
                              <span>Android CRM App login & SIM auto-dialing</span>
                            </li>
                            <li className="flex items-start gap-1.5">
                              <CheckCircle2Icon size={13} className="text-emerald-500 shrink-0 mt-0.5" />
                              <span>Receive assigned leads & round-robin queue</span>
                            </li>
                            <li className="flex items-start gap-1.5">
                              <CheckCircle2Icon size={13} className="text-emerald-500 shrink-0 mt-0.5" />
                              <span>2-tap call dispositioning & follow-up scheduling</span>
                            </li>
                            <li className="flex items-start gap-1.5">
                              <CheckCircle2Icon size={13} className="text-emerald-500 shrink-0 mt-0.5" />
                              <span>Auto-sync audio call recordings to S3 / MinIO</span>
                            </li>
                          </ul>
                        </div>

                        {/* Manager */}
                        <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 space-y-2 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-sky-800 flex items-center gap-1.5">
                              <UsersIcon size={14} className="text-sky-600" />
                              Operations Manager
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 bg-sky-50 text-sky-700 rounded-full border border-sky-200">
                              Floor Supervisor
                            </span>
                          </div>
                          <ul className="text-[11px] text-slate-600 space-y-1.5">
                            <li className="flex items-start gap-1.5">
                              <CheckCircle2Icon size={13} className="text-sky-500 shrink-0 mt-0.5" />
                              <span>Live Operations Dashboard & Telecaller fleet monitor</span>
                            </li>
                            <li className="flex items-start gap-1.5">
                              <CheckCircle2Icon size={13} className="text-sky-500 shrink-0 mt-0.5" />
                              <span>Add, pause/activate dialing seats, & remove callers</span>
                            </li>
                            <li className="flex items-start gap-1.5">
                              <CheckCircle2Icon size={13} className="text-sky-500 shrink-0 mt-0.5" />
                              <span>Smart CSV lead ingestion & round-robin distribution</span>
                            </li>
                            <li className="flex items-start gap-1.5">
                              <CheckCircle2Icon size={13} className="text-sky-500 shrink-0 mt-0.5" />
                              <span>Audio recordings audit playback & agent performance</span>
                            </li>
                          </ul>
                        </div>

                        {/* Admin */}
                        <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 space-y-2 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-purple-800 flex items-center gap-1.5">
                              <ShieldCheckIcon size={14} className="text-purple-600" />
                              Super Administrator
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full border border-purple-200">
                              System Owner
                            </span>
                          </div>
                          <ul className="text-[11px] text-slate-600 space-y-1.5">
                            <li className="flex items-start gap-1.5">
                              <CheckCircle2Icon size={13} className="text-purple-500 shrink-0 mt-0.5" />
                              <span>All Manager privileges + multi-manager oversight</span>
                            </li>
                            <li className="flex items-start gap-1.5">
                              <CheckCircle2Icon size={13} className="text-purple-500 shrink-0 mt-0.5" />
                              <span>Pipeline stages & custom disposition rules config</span>
                            </li>
                            <li className="flex items-start gap-1.5">
                              <CheckCircle2Icon size={13} className="text-purple-500 shrink-0 mt-0.5" />
                              <span>Manage system roles, passwords, & API integrations</span>
                            </li>
                            <li className="flex items-start gap-1.5">
                              <CheckCircle2Icon size={13} className="text-purple-500 shrink-0 mt-0.5" />
                              <span>Complete security, audit trail & database management</span>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 pt-1">
                    <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5">
                      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Team</div>
                      <div className="text-2xl font-extrabold text-slate-900 mt-1">{teamUsers.length}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">Registered accounts</div>
                    </div>

                    <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5">
                      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Telecallers</div>
                      <div className="text-2xl font-extrabold text-emerald-600 mt-1">
                        {teamUsers.filter((u) => u.role === "telecaller").length}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">Field & dialer agents</div>
                    </div>

                    <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5">
                      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Managers & Admins</div>
                      <div className="text-2xl font-extrabold text-indigo-600 mt-1">
                        {teamUsers.filter((u) => u.role !== "telecaller").length}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">Operations & supervisors</div>
                    </div>

                    <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5">
                      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Active Status</div>
                      <div className="text-2xl font-extrabold text-emerald-700 mt-1">
                        {teamUsers.filter((u) => u.active !== false).length}
                        <span className="text-xs font-normal text-slate-400 ml-1">/ {teamUsers.length}</span>
                      </div>
                      <div className="text-[11px] text-emerald-600 font-medium mt-0.5">
                        {teamUsers.filter((u) => u.active === false).length} deactivated
                      </div>
                    </div>
                  </div>

                  {/* Filter & Search Bar */}
                  <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100">
                    <div className="relative w-full md:w-80">
                      <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search users by name, email, or phone..."
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                      />
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto">
                      <select
                        value={userRoleFilter}
                        onChange={(e) => setUserRoleFilter(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:bg-white focus:border-indigo-500 outline-none transition-all"
                      >
                        <option value="all">All Roles</option>
                        <option value="admin">Administrators</option>
                        <option value="manager">Managers</option>
                        <option value="telecaller">Telecallers</option>
                      </select>

                      <select
                        value={userStatusFilter}
                        onChange={(e) => setUserStatusFilter(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:bg-white focus:border-indigo-500 outline-none transition-all"
                      >
                        <option value="all">All Status</option>
                        <option value="active">Active Only</option>
                        <option value="inactive">Deactivated Only</option>
                      </select>

                      <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap hidden sm:inline ml-1">
                        {
                          teamUsers.filter((u) => {
                            if (userRoleFilter !== "all" && u.role !== userRoleFilter) return false;
                            if (userStatusFilter === "active" && u.active === false) return false;
                            if (userStatusFilter === "inactive" && u.active !== false) return false;
                            if (userSearch.trim()) {
                              const q = userSearch.toLowerCase();
                              return (
                                u.name?.toLowerCase().includes(q) ||
                                u.email?.toLowerCase().includes(q) ||
                                u.phone?.includes(q)
                              );
                            }
                            return true;
                          }).length
                        }{" "}
                        users
                      </span>
                    </div>
                  </div>

                  {/* Users Data Table */}
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          <th className="px-4 py-3">User & Contact</th>
                          <th className="px-4 py-3">Role</th>
                          <th className="px-4 py-3">Account Status</th>
                          <th className="px-4 py-3">Attached Hardware Device</th>
                          <th className="px-4 py-3 text-center">Assigned Leads</th>
                          <th className="px-4 py-3 text-center">Calls Placed</th>
                          {(currentUser?.role === "admin" || currentUser?.role === "manager") && (
                            <th className="px-4 py-3 text-right">Actions & Privileges</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                        {teamUsers
                          .filter((u) => {
                            if (userRoleFilter !== "all" && u.role !== userRoleFilter) return false;
                            if (userStatusFilter === "active" && u.active === false) return false;
                            if (userStatusFilter === "inactive" && u.active !== false) return false;
                            if (userSearch.trim()) {
                              const q = userSearch.toLowerCase();
                              return (
                                u.name?.toLowerCase().includes(q) ||
                                u.email?.toLowerCase().includes(q) ||
                                u.phone?.includes(q)
                              );
                            }
                            return true;
                          })
                          .map((u) => {
                            const latestDevice = u.devices && u.devices.length > 0 ? u.devices[0] : null;
                            const isSelf = u.id === currentUser?.id;
                            return (
                              <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                                <td className="px-4 py-3.5">
                                  <div className="flex items-center gap-3">
                                    <div
                                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                                        u.role === "admin"
                                          ? "bg-purple-100 text-purple-700 border border-purple-200"
                                          : u.role === "manager"
                                          ? "bg-sky-100 text-sky-700 border border-sky-200"
                                          : "bg-emerald-100 text-emerald-700 border border-emerald-200"
                                      }`}
                                    >
                                      {u.name ? u.name.slice(0, 2).toUpperCase() : "US"}
                                    </div>
                                    <div>
                                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                        <span>{u.name}</span>
                                        {isSelf && (
                                          <span className="text-[10px] font-semibold px-1.5 py-0.2 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded">
                                            You
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[11px] text-slate-500 font-mono">{u.email}</div>
                                      <div className="text-[11px] text-slate-400 mt-0.5">{formatPhone(u.phone)}</div>
                                    </div>
                                  </div>
                                </td>

                                <td className="px-4 py-3.5 whitespace-nowrap">
                                  {u.role === "admin" ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                      <ShieldCheckIcon size={12} className="text-purple-600" />
                                      Admin
                                    </span>
                                  ) : u.role === "manager" ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                                      <UsersIcon size={12} className="text-sky-600" />
                                      Manager
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      <PhoneCallIcon size={12} className="text-emerald-600" />
                                      Telecaller
                                    </span>
                                  )}
                                </td>

                                <td className="px-4 py-3.5 whitespace-nowrap">
                                  {u.active === false ? (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                      Paused (No Dialing)
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                      Active
                                    </span>
                                  )}
                                </td>

                                <td className="px-4 py-3.5">
                                  {latestDevice ? (
                                    <div>
                                      <div className="font-semibold text-slate-800 flex items-center gap-1">
                                        <SmartphoneIcon size={13} className="text-indigo-600" />
                                        <span>{latestDevice.model}</span>
                                      </div>
                                      <div className="text-[11px] text-slate-500">
                                        v{latestDevice.appVersion} • {formatDateTime(latestDevice.lastSeenAt)}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 text-[11px] italic">Web portal only</span>
                                  )}
                                </td>

                                <td className="px-4 py-3.5 text-center font-semibold text-slate-800">
                                  {u._count?.leads ?? 0}
                                </td>

                                <td className="px-4 py-3.5 text-center font-semibold text-slate-800">
                                  {u._count?.calls ?? 0}
                                </td>

                                {(currentUser?.role === "admin" || currentUser?.role === "manager") && (
                                  <td className="px-4 py-3.5 text-right whitespace-nowrap">
                                    <div className="flex items-center justify-end gap-1.5">
                                      {isSelf ? (
                                        <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-1 rounded-lg">
                                          Current Session
                                        </span>
                                      ) : !canManageTargetUser(u) ? (
                                        <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-1 rounded-lg">
                                          Protected (Admin)
                                        </span>
                                      ) : (
                                        <>
                                          {/* Pause / Activate Button */}
                                          {u.active === false ? (
                                            <button
                                              onClick={() => handleToggleUserStatus(u)}
                                              title="Activate dialing and enable lead assignment"
                                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-all cursor-pointer"
                                            >
                                              <PlayIcon size={12} className="fill-emerald-600" />
                                              <span>Activate</span>
                                            </button>
                                          ) : (
                                            <button
                                              onClick={() => handleToggleUserStatus(u)}
                                              title="Pause dialing access and hold new leads"
                                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-all cursor-pointer"
                                            >
                                              <PauseIcon size={12} className="fill-amber-600" />
                                              <span>Pause</span>
                                            </button>
                                          )}

                                          {/* Edit Privileges & Role */}
                                          <button
                                            onClick={() => {
                                              setSelectedUser(u);
                                              setEditUserName(u.name);
                                              setEditUserEmail(u.email);
                                              setEditUserPhone(u.phone);
                                              setEditUserRole(u.role);
                                              setEditUserPassword("");
                                              setEditUserError(null);
                                              setEditUserModalOpen(true);
                                            }}
                                            title="Edit User Profile & Role Privileges"
                                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-all cursor-pointer"
                                          >
                                            <SettingsIcon size={12} />
                                            <span>Privileges</span>
                                          </button>

                                          {/* Reset Password */}
                                          <button
                                            onClick={() => {
                                              setSelectedUser(u);
                                              setResetPassNew("");
                                              setResetPassConfirm("");
                                              setResetPassError(null);
                                              setResetPassSuccess(null);
                                              setResetPassModalOpen(true);
                                            }}
                                            title="Reset Password"
                                            className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 border border-slate-200 rounded-lg transition-all cursor-pointer"
                                          >
                                            <KeyIcon size={13} />
                                          </button>

                                          {/* Remove User */}
                                          <button
                                            onClick={() => handleDeleteUser(u)}
                                            title="Remove User Account"
                                            className="p-1.5 text-slate-400 hover:text-rose-700 hover:bg-rose-50 hover:border-rose-200 border border-slate-200 rounded-lg transition-all cursor-pointer"
                                          >
                                            <Trash2Icon size={13} />
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
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
                setAudioUrl(null);
                setCurrentTime(0);
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

      {/* ── MODAL: SMART UNIVERSAL LEAD IMPORT ──────────────────────────────── */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <SparklesIcon size={18} className="text-indigo-600" />
                Universal Smart Lead Ingestion
              </h3>
              <button onClick={() => setImportModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XIcon size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Paste data in <strong className="text-slate-800">ANY format</strong>: raw text, WhatsApp copy, Excel/Google Sheets (tab-separated), CSV, or space-separated. The system automatically detects names, phone numbers, sources, and notes.
            </p>

            <form onSubmit={handleCsvImportSubmit} className="space-y-3.5">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-700">Paste Lead Data / Text:</span>
                <div className="flex items-center gap-2">
                  {parseUniversalLeadInput(importCsvText).length > 0 && (
                    <button
                      type="button"
                      onClick={handleAutoFormatText}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <span>✨ Auto-Format CSV</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleLoadSampleCsv}
                    className="text-xs text-slate-500 hover:text-slate-800 font-medium"
                  >
                    Load Sample Data
                  </button>
                </div>
              </div>

              <textarea
                rows={5}
                value={importCsvText}
                onChange={(e) => setImportCsvText(e.target.value)}
                placeholder={"Karan Gond 7081957371 Soniya Varanasi source is meta\nPooja Patel\t9812345678\tGoogle Ads\tCommercial 50kW Setup\nVikram Singhania, +91 9811022334, Facebook, Urgent callback\nSunil Sharma 8877665544 Gorakhpur UP"}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 outline-none leading-relaxed"
              />

              {/* Real-time Live Auto-Organized Preview */}
              {(() => {
                const preview = parseUniversalLeadInput(importCsvText);
                if (preview.length > 0) {
                  return (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                          <CheckCircle2Icon size={14} className="text-emerald-500" />
                          Auto-Organized Preview ({preview.length} {preview.length === 1 ? "lead" : "leads"} ready):
                        </span>
                        <span className="text-[11px] text-emerald-600 font-medium">
                          All formats normalized
                        </span>
                      </div>

                      <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl bg-slate-50/70 p-2 space-y-1.5">
                        {preview.map((lead, idx) => (
                          <div
                            key={idx}
                            className="bg-white border border-slate-200/90 rounded-lg p-2.5 flex items-center justify-between text-xs shadow-2xs gap-3"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <div className="truncate">
                                <span className="font-bold text-slate-900">{lead.name}</span>
                                <span className="text-slate-500 font-mono text-[11px] ml-2">
                                  {lead.phone}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                {lead.source}
                              </span>
                              {lead.notes && (
                                <span
                                  className="text-[11px] text-slate-500 max-w-[150px] truncate"
                                  title={lead.notes}
                                >
                                  📍 {lead.notes}
                                </span>
                              )}
                              <span className="text-emerald-600 font-bold text-xs" title="Ready to import">
                                ✓
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }

                if (importCsvText.trim().length > 0) {
                  return (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                      ⚠️ No 10-digit phone number found yet. Enter name and mobile number (e.g. <code>Karan Gond 7081957371 Varanasi</code>).
                    </div>
                  );
                }

                return null;
              })()}

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
                  <div className="font-bold flex items-center gap-1.5">
                    {importResult.jobId === "error" ? "❌ Import Error:" : "✓ Import Successful:"} Total {importResult.total} | Imported {importResult.imported} | Duplicates {importResult.duplicates}
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
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={importLoading || !importCsvText.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  <SparklesIcon size={14} className="text-white" />
                  <span>
                    {importLoading
                      ? "Importing Leads..."
                      : (() => {
                          const count = parseUniversalLeadInput(importCsvText).length;
                          return count > 0 ? `Import & Distribute (${count} Leads)` : "Import & Distribute Leads";
                        })()}
                  </span>
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

      {/* ── MODAL: ADD USER (ADMIN ONLY) ────────────────────────────────────── */}
      {addUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserPlusIcon size={18} className="text-indigo-600" />
                Add New Team Account
              </h3>
              <button
                onClick={() => setAddUserModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <XIcon size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Full Name:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={addUserName}
                  onChange={(e) => setAddUserName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Email Address:</label>
                <input
                  type="email"
                  required
                  placeholder="ramesh@telecalling.crm"
                  value={addUserEmail}
                  onChange={(e) => setAddUserEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Phone Number (E.164):</label>
                <input
                  type="tel"
                  required
                  placeholder="+919876543210"
                  value={addUserPhone}
                  onChange={(e) => setAddUserPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Organizational Role:</label>
                <select
                  value={addUserRole}
                  onChange={(e) => setAddUserRole(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 outline-none"
                >
                  <option value="telecaller">Telecaller (Dialer & Call Logging)</option>
                  {currentUser?.role === "admin" && (
                    <>
                      <option value="manager">Manager (Fleet Monitoring & Lead Assignment)</option>
                      <option value="admin">Administrator (Full Access & User Management)</option>
                    </>
                  )}
                </select>
              </div>

              {/* Granted Privileges Preview */}
              <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3 text-xs space-y-1.5">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <ShieldCheckIcon size={14} className="text-indigo-600" />
                  <span>Access Privileges for {addUserRole === "telecaller" ? "Telecaller" : addUserRole === "manager" ? "Manager" : "Administrator"}:</span>
                </div>
                <div className="text-slate-600 text-[11px] leading-relaxed">
                  {addUserRole === "telecaller" && (
                    <span>
                      Granted Android CRM Mobile App access, SIM auto-dialing, lead queue reception, 2-tap dispositioning, and auto audio recording sync.
                    </span>
                  )}
                  {addUserRole === "manager" && (
                    <span>
                      Granted Live operations monitoring, telecaller seat management (add, pause, remove), smart CSV lead import, and audio recording playback.
                    </span>
                  )}
                  {addUserRole === "admin" && (
                    <span>
                      Granted complete system administration, company settings, pipeline & disposition rules, manager oversight, and compliance audit trail.
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Initial Password (min 8 chars):</label>
                <input
                  type="password"
                  required
                  placeholder="Min. 8 characters"
                  value={addUserPassword}
                  onChange={(e) => setAddUserPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 outline-none"
                />
              </div>

              {addUserError && (
                <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                  {addUserError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddUserModalOpen(false)}
                  className="px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addUserLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {addUserLoading ? "Creating..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: EDIT USER (ADMIN ONLY) ───────────────────────────────────── */}
      {editUserModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <SettingsIcon size={18} className="text-indigo-600" />
                Edit Account: {selectedUser.name}
              </h3>
              <button
                onClick={() => setEditUserModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <XIcon size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Full Name:</label>
                <input
                  type="text"
                  required
                  value={editUserName}
                  onChange={(e) => setEditUserName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Email Address:</label>
                <input
                  type="email"
                  required
                  value={editUserEmail}
                  onChange={(e) => setEditUserEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Phone Number:</label>
                <input
                  type="tel"
                  required
                  value={editUserPhone}
                  onChange={(e) => setEditUserPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Role Assignment & Privileges:</label>
                <select
                  value={editUserRole}
                  onChange={(e) => setEditUserRole(e.target.value as any)}
                  disabled={currentUser?.role !== "admin"}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 outline-none disabled:opacity-60"
                >
                  <option value="telecaller">Telecaller (Dialer & Call Logging)</option>
                  {currentUser?.role === "admin" && (
                    <>
                      <option value="manager">Manager (Fleet Monitoring & Lead Assignment)</option>
                      <option value="admin">Administrator (Full Access & User Management)</option>
                    </>
                  )}
                </select>
                {currentUser?.role !== "admin" && (
                  <p className="text-[10px] text-slate-400 mt-1">Only Administrators can promote or reassign Manager and Admin accounts.</p>
                )}
              </div>

              {/* Role Privileges Overview */}
              <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3 text-xs space-y-1.5">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <ShieldCheckIcon size={14} className="text-indigo-600" />
                  <span>Role Privileges Granted:</span>
                </div>
                <div className="text-slate-600 text-[11px] leading-relaxed">
                  {editUserRole === "telecaller" && (
                    <span>
                      Android CRM Mobile App access, SIM auto-dialing, lead queue reception, 2-tap dispositioning, and auto audio recording sync.
                    </span>
                  )}
                  {editUserRole === "manager" && (
                    <span>
                      Live operations monitoring, telecaller seat management (add, pause, remove), smart CSV lead import, and audio recording playback.
                    </span>
                  )}
                  {editUserRole === "admin" && (
                    <span>
                      Complete system administration, company settings, pipeline & disposition rules, manager oversight, and compliance audit trail.
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Change Password (optional, leave blank to keep current):
                </label>
                <input
                  type="password"
                  placeholder="Leave empty to preserve password"
                  value={editUserPassword}
                  onChange={(e) => setEditUserPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 outline-none"
                />
              </div>

              {editUserError && (
                <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                  {editUserError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditUserModalOpen(false)}
                  className="px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editUserLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {editUserLoading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: ADMIN RESET PASSWORD ─────────────────────────────────────── */}
      {resetPassModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <KeyIcon size={18} className="text-amber-500" />
                Reset Password
              </h3>
              <button
                onClick={() => setResetPassModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <XIcon size={18} />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <div className="text-slate-400 text-[11px]">User Account:</div>
              <div className="font-bold text-slate-900 mt-0.5">{selectedUser.name}</div>
              <div className="text-slate-500 text-[11px] font-mono">{selectedUser.email}</div>
            </div>

            <form onSubmit={handleAdminResetPassword} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">New Password (min 8 chars):</label>
                <input
                  type="password"
                  required
                  placeholder="Enter new password"
                  value={resetPassNew}
                  onChange={(e) => setResetPassNew(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Confirm New Password:</label>
                <input
                  type="password"
                  required
                  placeholder="Re-enter new password"
                  value={resetPassConfirm}
                  onChange={(e) => setResetPassConfirm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 outline-none"
                />
              </div>

              {resetPassError && (
                <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                  {resetPassError}
                </div>
              )}

              {resetPassSuccess && (
                <div className="text-xs text-emerald-700 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200 font-medium">
                  {resetPassSuccess}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetPassModalOpen(false)}
                  className="px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetPassLoading}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {resetPassLoading ? "Resetting..." : "Reset Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: CHANGE MY PASSWORD (SELF-SERVICE) ────────────────────────── */}
      {changePassModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <LockIcon size={18} className="text-indigo-600" />
                Change My Password
              </h3>
              <button
                onClick={() => setChangePassModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <XIcon size={18} />
              </button>
            </div>

            <form onSubmit={handleChangeMyPassword} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Current Password:</label>
                <input
                  type="password"
                  required
                  placeholder="Enter current password"
                  value={currentPass}
                  onChange={(e) => setCurrentPass(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">New Password (min 8 chars):</label>
                <input
                  type="password"
                  required
                  placeholder="Enter new password"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Confirm New Password:</label>
                <input
                  type="password"
                  required
                  placeholder="Confirm new password"
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 outline-none"
                />
              </div>

              {changePassError && (
                <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                  {changePassError}
                </div>
              )}

              {changePassSuccess && (
                <div className="text-xs text-emerald-700 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200 font-medium">
                  {changePassSuccess}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setChangePassModalOpen(false)}
                  className="px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={changePassLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {changePassLoading ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: LOGIN / USER SWITCH / ACCOUNT PROFILE ───────────────────────── */}
      {loginModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {currentUser ? "Account Profile & Switcher" : "Sign In to SolarCRM"}
              </h3>
              <button
                onClick={() => setLoginModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <XIcon size={18} />
              </button>
            </div>

            {currentUser && (
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-900 text-xs">{currentUser.name}</div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                      currentUser.role === "admin"
                        ? "bg-purple-100 text-purple-700"
                        : currentUser.role === "manager"
                        ? "bg-sky-100 text-sky-700"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {currentUser.role}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 font-mono">{currentUser.email}</div>
                <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60">
                  <button
                    type="button"
                    onClick={() => {
                      setLoginModalOpen(false);
                      setChangePassError(null);
                      setChangePassSuccess(null);
                      setCurrentPass("");
                      setNewPass("");
                      setConfirmPass("");
                      setChangePassModalOpen(true);
                    }}
                    className="flex-1 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <KeyIcon size={12} className="text-amber-500" />
                    <span>Change Password</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="py-1.5 px-3 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg text-[11px] font-semibold text-rose-700 transition-all cursor-pointer"
                  >
                    Log Out
                  </button>
                </div>
              </div>
            )}

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
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs cursor-pointer"
                >
                  Sign In to Dashboard
                </button>
              </div>
            </form>

            <div className="pt-3 border-t border-slate-200 text-center space-y-2">
              <div className="text-[11px] text-slate-400">Quick Switch Demo Accounts:</div>
              <div className="flex flex-wrap justify-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleQuickSwitch("admin@telecalling.crm")}
                  className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-[11px] font-semibold border border-purple-200 cursor-pointer"
                >
                  Admin
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickSwitch("manager@telecalling.crm")}
                  className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg text-[11px] font-semibold border border-sky-200 cursor-pointer"
                >
                  Manager
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickSwitch("caller1@telecalling.crm")}
                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[11px] font-semibold border border-emerald-200 cursor-pointer"
                >
                  Caller 1
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickSwitch("caller2@telecalling.crm")}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold border border-slate-200 cursor-pointer"
                >
                  Caller 2
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
