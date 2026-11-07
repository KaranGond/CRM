import type * as SQLite from "expo-sqlite";

// Safe cross-environment platform & SQLite detection
let Platform = { OS: "web" };
let SQLiteModule: any = null;

try {
  if (typeof process === "undefined" || !process.versions?.node) {
    const rn = require("react-native");
    Platform = rn.Platform;
    SQLiteModule = require("expo-sqlite");
  }
} catch {
  // Fallback to web/memory store in Node test environments
  Platform = { OS: "web" };
}

export interface CachedLead {
  id: string;
  name: string;
  phoneE164: string;
  altPhones?: string[];
  stage: string;
  source: string;
  notes?: string;
  priority?: number;
  nextFollowUpAt?: string;
  cachedAt: string;
  dnd?: boolean;
}

export interface CachedDisposition {
  id: string;
  label: string;
  orderIdx: number;
  setsStageId?: string;
  requiresFollowUp: boolean;
  templateId?: string;
}

export interface CachedCall {
  id: string;
  leadId?: string;
  leadName?: string;
  numberE164: string;
  startedAt: string;
  endedAt?: string;
  durationSec: number;
  outcome: string;
  direction: string;
  sim: string;
  dispositionId?: string;
  dispositionLabel?: string;
  remark?: string;
  followUpAt?: string;
  recordingUri?: string;
  recordingStatus?: string;
  syncStatus?: string;
}

export interface OutboxMutation {
  id: string;
  mutationType:
    | "CALL_CAPTURED"
    | "DISPOSITION_SAVED"
    | "FOLLOWUP_DONE"
    | "FOLLOWUP_CREATED"
    | "LEAD_UPDATED"
    | "LEAD_CREATED";
  payloadJson: string;
  status: "PENDING" | "SYNCED" | "FAILED";
  retryCount: number;
  createdAt: string;
}

export interface SyncMeta {
  lastSyncAt: string | null;
  serverCursor: number;
  isLeaseValid: boolean;
  hoursSinceLastSync: number;
}

const DB_NAME = "telecalling_crm_offline.db";
const OFFLINE_LEASE_MAX_HOURS = 72;

class SqliteStore {
  private db: SQLite.SQLiteDatabase | null = null;
  private memoryLeads: Map<string, CachedLead> = new Map();
  private memoryCalls: Map<string, CachedCall> = new Map();
  private memoryOutbox: OutboxMutation[] = [];
  private memoryCursor: number = 0;
  private memoryLastSync: string | null = null;
  private memoryMeta: Map<string, string> = new Map();
  private isInitialized = false;

  async init(): Promise<void> {
    if (this.isInitialized) return;

    if (Platform.OS !== "web") {
      try {
        this.db = await SQLiteModule.openDatabaseAsync(DB_NAME);
        await this.db!.execAsync(`
          PRAGMA journal_mode = WAL;

          CREATE TABLE IF NOT EXISTS cached_leads (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            phoneE164 TEXT NOT NULL,
            altPhones TEXT,
            stage TEXT NOT NULL,
            source TEXT,
            notes TEXT,
            priority INTEGER DEFAULT 0,
            nextFollowUpAt TEXT,
            cachedAt TEXT NOT NULL,
            dnd INTEGER DEFAULT 0
          );

          CREATE TABLE IF NOT EXISTS cached_dispositions (
            id TEXT PRIMARY KEY,
            label TEXT NOT NULL,
            orderIdx INTEGER DEFAULT 0,
            setsStageId TEXT,
            requiresFollowUp INTEGER DEFAULT 0,
            templateId TEXT
          );

          CREATE TABLE IF NOT EXISTS cached_calls (
            id TEXT PRIMARY KEY,
            leadId TEXT,
            leadName TEXT,
            numberE164 TEXT NOT NULL,
            startedAt TEXT NOT NULL,
            endedAt TEXT,
            durationSec INTEGER DEFAULT 0,
            outcome TEXT NOT NULL,
            direction TEXT DEFAULT 'OUTBOUND',
            sim TEXT DEFAULT 'SIM1',
            dispositionId TEXT,
            dispositionLabel TEXT,
            remark TEXT,
            followUpAt TEXT,
            recordingUri TEXT,
            recordingStatus TEXT DEFAULT 'PENDING',
            syncStatus TEXT DEFAULT 'PENDING'
          );

          CREATE TABLE IF NOT EXISTS outbox_mutations (
            id TEXT PRIMARY KEY,
            mutationType TEXT NOT NULL,
            payloadJson TEXT NOT NULL,
            status TEXT DEFAULT 'PENDING',
            retryCount INTEGER DEFAULT 0,
            createdAt TEXT NOT NULL
          );

          CREATE TABLE IF NOT EXISTS sync_metadata (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updatedAt TEXT NOT NULL
          );
        `);

        try {
          await this.db!.execAsync(`ALTER TABLE cached_leads ADD COLUMN altPhones TEXT;`);
        } catch {
          // column already exists
        }
      } catch (err) {
        console.warn("[SqliteStore] Falling back to memory store:", err);
      }
    }
    this.isInitialized = true;
  }

  /**
   * Save or replace the caller's queue in local offline storage
   */
  async cacheLeads(leads: CachedLead[]): Promise<void> {
    await this.init();
    if (this.db) {
      await this.db.withTransactionAsync(async () => {
        for (const lead of leads) {
          await this.db!.runAsync(
            `INSERT OR REPLACE INTO cached_leads 
             (id, name, phoneE164, altPhones, stage, source, notes, priority, nextFollowUpAt, cachedAt, dnd)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              lead.id,
              lead.name,
              lead.phoneE164,
              JSON.stringify(lead.altPhones || []),
              lead.stage,
              lead.source ?? "",
              lead.notes ?? "",
              lead.priority ?? 0,
              lead.nextFollowUpAt ?? null,
              lead.cachedAt || new Date().toISOString(),
              lead.dnd ? 1 : 0,
            ],
          );
        }
      });
    } else {
      for (const lead of leads) {
        this.memoryLeads.set(lead.id, lead);
      }
    }
  }

  /**
   * Find a lead by normalized phone number or 10-digit suffix (checks primary and alternate phones)
   */
  async findLeadByPhone(phone: string): Promise<CachedLead | null> {
    await this.init();
    const clean10 = phone.replace(/\D/g, "").slice(-10);
    if (!clean10) return null;

    if (this.db) {
      const rows = await this.db.getAllAsync<any>(
        `SELECT * FROM cached_leads WHERE phoneE164 LIKE ? OR altPhones LIKE ? LIMIT 1`,
        [`%${clean10}`, `%"%${clean10}%"`],
      );
      if (rows && rows.length > 0) {
        const r = rows[0];
        let parsedAlts: string[] = [];
        try {
          parsedAlts = r.altPhones ? JSON.parse(r.altPhones) : [];
        } catch {
          parsedAlts = [];
        }
        return {
          id: r.id,
          name: r.name,
          phoneE164: r.phoneE164,
          altPhones: parsedAlts,
          stage: r.stage,
          source: r.source,
          notes: r.notes,
          priority: r.priority,
          nextFollowUpAt: r.nextFollowUpAt,
          cachedAt: r.cachedAt,
          dnd: Boolean(r.dnd),
        };
      }
    } else {
      for (const lead of this.memoryLeads.values()) {
        const lead10 = (lead.phoneE164 || "").replace(/\D/g, "").slice(-10);
        if (lead10 === clean10) return lead;
        if (Array.isArray(lead.altPhones)) {
          for (const alt of lead.altPhones) {
            if ((alt || "").replace(/\D/g, "").slice(-10) === clean10) return lead;
          }
        }
      }
    }
    return null;
  }

  /**
   * Read all cached leads sorted by follow-up priority and cache date
   */
  async getCachedLeads(): Promise<CachedLead[]> {
    await this.init();
    if (this.db) {
      const rows = await this.db.getAllAsync<any>(
        `SELECT * FROM cached_leads ORDER BY priority DESC, nextFollowUpAt ASC, cachedAt ASC`,
      );
      return rows.map((r: any) => {
        let parsedAlts: string[] = [];
        try {
          parsedAlts = r.altPhones ? JSON.parse(r.altPhones) : [];
        } catch {
          parsedAlts = [];
        }
        return {
          id: r.id,
          name: r.name,
          phoneE164: r.phoneE164,
          altPhones: parsedAlts,
          stage: r.stage,
          source: r.source,
          notes: r.notes,
          priority: r.priority,
          nextFollowUpAt: r.nextFollowUpAt,
          cachedAt: r.cachedAt,
          dnd: Boolean(r.dnd),
        };
      });
    }
    return Array.from(this.memoryLeads.values()).sort((a, b) => {
      const pDiff = (b.priority ?? 0) - (a.priority ?? 0);
      if (pDiff !== 0) return pDiff;
      if (a.nextFollowUpAt && b.nextFollowUpAt) {
        return new Date(a.nextFollowUpAt).getTime() - new Date(b.nextFollowUpAt).getTime();
      }
      if (a.nextFollowUpAt) return -1;
      if (b.nextFollowUpAt) return 1;
      return new Date(a.cachedAt).getTime() - new Date(b.cachedAt).getTime();
    });
  }

  /**
   * Priority Auto-Dial Queue:
   * 1. Overdue callbacks first
   * 2. Upcoming callbacks
   * 3. Fresh uncalled leads sorted by priority DESC, cachedAt ASC
   * Omits DND flagged prospects strictly.
   */
  async getAutoDialQueue(): Promise<CachedLead[]> {
    await this.init();
    const nowIso = new Date().toISOString();
    const now = Date.now();

    if (this.db) {
      const rows = await this.db.getAllAsync<any>(
        `SELECT * FROM cached_leads 
         WHERE dnd = 0 OR dnd IS NULL
         ORDER BY 
           CASE 
             WHEN nextFollowUpAt IS NOT NULL AND nextFollowUpAt <= ? THEN 0
             WHEN nextFollowUpAt IS NOT NULL THEN 1
             ELSE 2 
           END,
           priority DESC, 
           cachedAt ASC`,
        [nowIso],
      );
      return rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        phoneE164: r.phoneE164,
        stage: r.stage,
        source: r.source,
        notes: r.notes,
        priority: r.priority,
        nextFollowUpAt: r.nextFollowUpAt,
        cachedAt: r.cachedAt,
        dnd: Boolean(r.dnd),
      }));
    }

    return Array.from(this.memoryLeads.values())
      .filter((l) => !l.dnd)
      .sort((a, b) => {
        const aOverdue = a.nextFollowUpAt && new Date(a.nextFollowUpAt).getTime() <= now;
        const bOverdue = b.nextFollowUpAt && new Date(b.nextFollowUpAt).getTime() <= now;
        if (aOverdue && !bOverdue) return -1;
        if (!aOverdue && bOverdue) return 1;

        const aUpcoming = a.nextFollowUpAt && new Date(a.nextFollowUpAt).getTime() > now;
        const bUpcoming = b.nextFollowUpAt && new Date(b.nextFollowUpAt).getTime() > now;
        if (aUpcoming && !bUpcoming) return -1;
        if (!aUpcoming && bUpcoming) return 1;

        const pDiff = (b.priority ?? 0) - (a.priority ?? 0);
        if (pDiff !== 0) return pDiff;

        return new Date(a.cachedAt).getTime() - new Date(b.cachedAt).getTime();
      });
  }

  /**
   * Remove lead from queue once dispositioned or completed
   */
  async removeCachedLead(leadId: string): Promise<void> {
    await this.init();
    if (this.db) {
      await this.db.runAsync(`DELETE FROM cached_leads WHERE id = ?`, [leadId]);
    } else {
      this.memoryLeads.delete(leadId);
    }
  }

  /**
   * Update notes, stage, or reminder for a cached lead
   */
  async updateCachedLead(leadId: string, updates: Partial<CachedLead>): Promise<void> {
    await this.init();
    if (this.db) {
      const sets: string[] = [];
      const values: any[] = [];
      if (updates.notes !== undefined) {
        sets.push("notes = ?");
        values.push(updates.notes);
      }
      if (updates.stage !== undefined) {
        sets.push("stage = ?");
        values.push(updates.stage);
      }
      if (updates.nextFollowUpAt !== undefined) {
        sets.push("nextFollowUpAt = ?");
        values.push(updates.nextFollowUpAt);
      }
      if (sets.length > 0) {
        values.push(leadId);
        await this.db.runAsync(
          `UPDATE cached_leads SET ${sets.join(", ")} WHERE id = ?`,
          values,
        );
      }
    } else {
      const existing = this.memoryLeads.get(leadId);
      if (existing) {
        this.memoryLeads.set(leadId, { ...existing, ...updates });
      }
    }
  }


  /**
   * Outbox: enqueue offline mutation for reliable sync
   */
  async enqueueMutation(type: OutboxMutation["mutationType"], payload: any): Promise<string> {
    await this.init();
    const id = `mut_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const payloadStr = JSON.stringify(payload);

    if (this.db) {
      await this.db.runAsync(
        `INSERT INTO outbox_mutations (id, mutationType, payloadJson, status, retryCount, createdAt)
         VALUES (?, ?, ?, 'PENDING', 0, ?)`,
        [id, type, payloadStr, now],
      );
    } else {
      this.memoryOutbox.push({
        id,
        mutationType: type,
        payloadJson: payloadStr,
        status: "PENDING",
        retryCount: 0,
        createdAt: now,
      });
    }
    return id;
  }

  /**
   * Record a single call locally
   */
  async recordCall(call: CachedCall): Promise<void> {
    return this.cacheCalls([call]);
  }

  /**
   * Cache or update call logs locally
   */
  async cacheCalls(calls: CachedCall[]): Promise<void> {
    await this.init();
    if (this.db) {
      await this.db.withTransactionAsync(async () => {
        for (const call of calls) {
          await this.db!.runAsync(
            `INSERT OR REPLACE INTO cached_calls 
             (id, leadId, leadName, numberE164, startedAt, endedAt, durationSec, outcome, direction, sim, dispositionId, dispositionLabel, remark, followUpAt, recordingUri, recordingStatus, syncStatus)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              call.id,
              call.leadId ?? null,
              call.leadName ?? "",
              call.numberE164,
              call.startedAt,
              call.endedAt ?? null,
              call.durationSec ?? 0,
              call.outcome,
              call.direction ?? "OUTBOUND",
              call.sim ?? "SIM1",
              call.dispositionId ?? null,
              call.dispositionLabel ?? null,
              call.remark ?? "",
              call.followUpAt ?? null,
              call.recordingUri ?? null,
              call.recordingStatus ?? "PENDING",
              call.syncStatus ?? "PENDING",
            ],
          );
        }
      });
    } else {
      for (const call of calls) {
        this.memoryCalls.set(call.id, call);
      }
    }
  }

  /**
   * Get all cached calls sorted by startedAt DESC
   */
  async getCachedCalls(limit: number = 50): Promise<CachedCall[]> {
    await this.init();
    if (this.db) {
      const rows = await this.db.getAllAsync<any>(
        `SELECT * FROM cached_calls ORDER BY startedAt DESC LIMIT ?`,
        [limit],
      );
      return rows;
    }
    return Array.from(this.memoryCalls.values())
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, limit);
  }

  /**
   * Update disposition and remark for a specific call in local cache
   */
  async updateCachedCallDisposition(
    callId: string,
    dispositionId: string,
    dispositionLabel: string,
    remark?: string,
    followUpAt?: string,
  ): Promise<void> {
    await this.init();
    if (this.db) {
      await this.db.runAsync(
        `UPDATE cached_calls 
         SET dispositionId = ?, dispositionLabel = ?, remark = ?, followUpAt = ? 
         WHERE id = ?`,
        [dispositionId, dispositionLabel, remark ?? "", followUpAt ?? null, callId],
      );
    } else {
      const call = this.memoryCalls.get(callId);
      if (call) {
        call.dispositionId = dispositionId;
        call.dispositionLabel = dispositionLabel;
        call.remark = remark ?? "";
        call.followUpAt = followUpAt;
      }
    }
  }

  /**
   * List pending mutations to be pushed to the server
   */
  async getPendingMutations(): Promise<OutboxMutation[]> {
    await this.init();
    if (this.db) {
      const rows = await this.db.getAllAsync<any>(
        `SELECT * FROM outbox_mutations WHERE status = 'PENDING' ORDER BY createdAt ASC`,
      );
      return rows;
    }
    return this.memoryOutbox.filter((m) => m.status === "PENDING");
  }

  /**
   * Mark mutation as synced or delete from outbox
   */
  async markMutationSynced(id: string): Promise<void> {
    await this.init();
    if (this.db) {
      await this.db.runAsync(`DELETE FROM outbox_mutations WHERE id = ?`, [id]);
    } else {
      this.memoryOutbox = this.memoryOutbox.filter((m) => m.id !== id);
    }
  }

  /**
   * Update arbitrary sync metadata key/value
   */
  async updateSyncMeta(key: string, value: string): Promise<void> {
    await this.init();
    const now = new Date().toISOString();
    if (this.db) {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO sync_metadata (key, value, updatedAt) VALUES (?, ?, ?)`,
        [key, value, now],
      );
    }
    this.memoryMeta.set(key, value);
    if (key === "last_sync") this.memoryLastSync = value;
    if (key === "server_cursor") this.memoryCursor = parseInt(value, 10) || 0;
  }

  /**
   * Retrieve arbitrary sync metadata key
   */
  async getSyncMetaValue(key: string): Promise<string | null> {
    await this.init();
    if (this.db) {
      const row = await this.db.getFirstAsync<any>(
        `SELECT value FROM sync_metadata WHERE key = ?`,
        [key],
      );
      return row ? row.value : null;
    }
    return this.memoryMeta.get(key) ?? null;
  }

  /**
   * Save sync metadata and update 72-hour offline lease timer
   */
  async recordSyncSuccess(newCursor: number): Promise<void> {
    await this.init();
    const now = new Date().toISOString();
    if (this.db) {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO sync_metadata (key, value, updatedAt) VALUES ('last_sync', ?, ?)`,
        [now, now],
      );
      await this.db.runAsync(
        `INSERT OR REPLACE INTO sync_metadata (key, value, updatedAt) VALUES ('server_cursor', ?, ?)`,
        [String(newCursor), now],
      );
    } else {
      this.memoryLastSync = now;
      this.memoryCursor = newCursor;
    }
  }

  /**
   * Check 72-hour offline lease. If caller hasn't synced in >72h, lock screen.
   */
  async getSyncMeta(): Promise<SyncMeta> {
    await this.init();
    let lastSyncStr: string | null = null;
    let cursor = 0;

    if (this.db) {
      const syncRow = await this.db.getFirstAsync<any>(
        `SELECT value FROM sync_metadata WHERE key = 'last_sync'`,
      );
      if (syncRow) lastSyncStr = syncRow.value;

      const cursorRow = await this.db.getFirstAsync<any>(
        `SELECT value FROM sync_metadata WHERE key = 'server_cursor'`,
      );
      if (cursorRow) cursor = parseInt(cursorRow.value, 10) || 0;
    } else {
      lastSyncStr = this.memoryLastSync;
      cursor = this.memoryCursor;
    }

    if (!lastSyncStr) {
      return {
        lastSyncAt: null,
        serverCursor: cursor,
        isLeaseValid: true,
        hoursSinceLastSync: 0,
      };
    }

    const lastSyncDate = new Date(lastSyncStr);
    const diffHours = (Date.now() - lastSyncDate.getTime()) / (1000 * 60 * 60);

    return {
      lastSyncAt: lastSyncStr,
      serverCursor: cursor,
      isLeaseValid: diffHours <= OFFLINE_LEASE_MAX_HOURS,
      hoursSinceLastSync: Math.floor(diffHours),
    };
  }

  async clearAll(): Promise<void> {
    if (this.db) {
      await this.db.execAsync(`
        DELETE FROM cached_leads;
        DELETE FROM cached_dispositions;
        DELETE FROM outbox_mutations;
        DELETE FROM sync_metadata;
      `);
    } else {
      this.memoryLeads.clear();
      this.memoryCalls.clear();
      this.memoryOutbox = [];
      this.memoryCursor = 0;
      this.memoryLastSync = null;
      this.memoryMeta.clear();
    }
  }
}

export const sqliteStore = new SqliteStore();
