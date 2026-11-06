import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Platform,
} from "react-native";
import {
  ShieldCheck,
  User,
  Phone,
  Zap,
  Building2,
  FileText,
  X,
  Sparkles,
} from "lucide-react-native";
import { CachedLead } from "../../store/sqliteStore";
import { CountdownRing } from "./CountdownRing";
import { ControlDeck } from "./ControlDeck";
import { GapSelector } from "./GapSelector";
import { SessionHUD } from "./SessionHUD";

interface AutoDialCockpitProps {
  visible: boolean;
  status: string;
  isPaused: boolean;
  countdownSec: number;
  callGapSec: number;
  currentLead: CachedLead | null;
  currentLeadIndex: number;
  totalQueueCount: number;
  dialedCount: number;
  connectRate: number;
  talkTimeSec: number;
  onPause: () => void;
  onResume: () => void;
  onSkip: () => void;
  onDialNow: () => void;
  onStop: () => void;
  onSelectGap: (sec: number) => void;
}

export const AutoDialCockpit: React.FC<AutoDialCockpitProps> = ({
  visible,
  status,
  isPaused,
  countdownSec,
  callGapSec,
  currentLead,
  currentLeadIndex,
  totalQueueCount,
  dialedCount,
  connectRate,
  talkTimeSec,
  onPause,
  onResume,
  onSkip,
  onDialNow,
  onStop,
  onSelectGap,
}) => {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onStop}
    >
      <SafeAreaView style={styles.safeContainer}>
        {/* Cockpit Top Bar */}
        <View style={styles.topBar}>
          <View style={styles.titleGroup}>
            <View style={styles.pulseDot} />
            <Text style={styles.cockpitTitle}>Auto-Dialer Queue</Text>
            <View style={[styles.statusBadge, isPaused && styles.statusBadgePaused]}>
              <Text
                style={[
                  styles.statusBadgeText,
                  isPaused && styles.statusBadgeTextPaused,
                ]}
              >
                {isPaused ? "PAUSED" : "ACTIVE"}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onStop}
            activeOpacity={0.7}
          >
            <X size={20} color="#64748B" strokeWidth={2.2} />
          </TouchableOpacity>
        </View>

        {/* Floating Session HUD */}
        <SessionHUD
          dialedCount={dialedCount}
          currentLeadIndex={currentLeadIndex}
          totalQueueCount={totalQueueCount}
          connectRate={connectRate}
          callGapSec={callGapSec}
          talkTimeSec={talkTimeSec}
        />

        <ScrollView
          style={styles.scrollBody}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Lead Preview Card */}
          {currentLead ? (
            <View style={styles.leadCard}>
              <View style={styles.leadHeaderRow}>
                <View style={styles.leadAvatarCircle}>
                  <User size={20} color="#2E7FE8" strokeWidth={2.2} />
                </View>
                <View style={styles.leadInfo}>
                  <Text style={styles.leadName}>{currentLead.name}</Text>
                  <View style={styles.phoneRow}>
                    <Phone size={13} color="#64748B" strokeWidth={2} />
                    <Text style={styles.phoneText}>{currentLead.phoneE164}</Text>
                  </View>
                </View>
                <View style={styles.stageBadge}>
                  <Text style={styles.stageBadgeText}>
                    {currentLead.stage || "New Lead"}
                  </Text>
                </View>
              </View>

              {/* Solar requirement / details */}
              <View style={styles.metaRow}>
                <View style={styles.metaPill}>
                  <Zap size={12} color="#F59E0B" strokeWidth={2} />
                  <Text style={styles.metaPillText}>
                    {currentLead.priority && currentLead.priority > 0
                      ? "High Priority"
                      : "Standard Lead"}
                  </Text>
                </View>
                <View style={styles.metaPill}>
                  <Building2 size={12} color="#64748B" strokeWidth={2} />
                  <Text style={styles.metaPillText}>
                    {currentLead.source || "Website Inbound"}
                  </Text>
                </View>
              </View>

              {/* Remarks / notes */}
              {currentLead.notes ? (
                <View style={styles.notesRow}>
                  <FileText size={12} color="#64748B" strokeWidth={2} />
                  <Text style={styles.notesText} numberOfLines={2}>
                    {currentLead.notes}
                  </Text>
                </View>
              ) : null}

              {/* Mandatory DPDP / TRAI Disclosure Banner */}
              <View style={styles.disclosureBanner}>
                <View style={styles.disclosureHeader}>
                  <ShieldCheck size={14} color="#059669" strokeWidth={2.2} />
                  <Text style={styles.disclosureTitle}>
                    DPDP Mandatory Disclosure Script
                  </Text>
                </View>
                <Text style={styles.disclosureBody}>
                  "Namaste {currentLead.name}, this call is from SolarCRM and may be
                  recorded for quality, documentation, and training purposes."
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Sparkles size={28} color="#2E7FE8" strokeWidth={2} />
              <Text style={styles.emptyTitle}>Queue Complete</Text>
              <Text style={styles.emptySubtitle}>
                All leads have been dialed for this session.
              </Text>
            </View>
          )}

          {/* Animated Countdown Ring */}
          <CountdownRing
            countdownSec={countdownSec}
            maxSec={callGapSec}
            isPaused={isPaused}
            status={status}
          />

          {/* Pacing Gap Selector */}
          <GapSelector
            currentGapSec={callGapSec}
            onSelectGap={onSelectGap}
          />
        </ScrollView>

        {/* Fixed Control Deck at Bottom */}
        <ControlDeck
          isPaused={isPaused}
          status={status}
          onPause={onPause}
          onResume={onResume}
          onSkip={onSkip}
          onDialNow={onDialNow}
          onStop={onStop}
        />
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F6",
    backgroundColor: "#FFFFFF",
  },
  titleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  cockpitTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1E293B",
  },
  statusBadge: {
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  statusBadgePaused: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#059669",
    letterSpacing: 0.5,
  },
  statusBadgeTextPaused: {
    color: "#D97706",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  leadCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EEF2F6",
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  leadHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  leadAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  leadInfo: {
    flex: 1,
  },
  leadName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  phoneText: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
  },
  stageBadge: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  stageBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#2E7FE8",
  },
  metaRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  metaPillText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#475569",
  },
  notesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    backgroundColor: "#F8FAFC",
    padding: 8,
    borderRadius: 8,
  },
  notesText: {
    fontSize: 12,
    color: "#475569",
    flex: 1,
    fontStyle: "italic",
  },
  disclosureBanner: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
  },
  disclosureHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 4,
  },
  disclosureTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#065F46",
    letterSpacing: 0.3,
  },
  disclosureBody: {
    fontSize: 11,
    color: "#047857",
    lineHeight: 16,
    fontStyle: "italic",
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EEF2F6",
    padding: 32,
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1E293B",
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    marginTop: 4,
  },
});

