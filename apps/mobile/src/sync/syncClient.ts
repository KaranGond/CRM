import { sqliteStore, OutboxMutation } from "../store/sqliteStore";
import { createApiClient } from "@telecalling-crm/api-client";

export class SyncClient {
  private apiBase: string;
  private tokenGetter: () => Promise<string | null>;

  constructor(apiBase: string, tokenGetter: () => Promise<string | null>) {
    this.apiBase = apiBase;
    this.tokenGetter = tokenGetter;
  }

  private async getClient() {
    return createApiClient({
      baseUrl: this.apiBase,
      getToken: this.tokenGetter,
    });
  }

  /**
   * Push local outbox mutations to the backend
   */
  async pushOutbox(): Promise<{ pushedCount: number; errors: number }> {
    const pending = await sqliteStore.getPendingMutations();
    if (pending.length === 0) return { pushedCount: 0, errors: 0 };

    const client = await this.getClient();
    const mutations = pending.map((m) => {
      let payload: Record<string, any> = {};
      try {
        payload = JSON.parse(m.payloadJson);
      } catch {
        payload = {};
      }
      return {
        mutationId: m.id,
        type: m.mutationType,
        payload,
        clientTimestamp: m.createdAt,
      };
    });

    try {
      const response = await client.sync.push({
        deviceId: "device-mobile-sim-01",
        mutations,
      });
      let pushedCount = 0;
      let errors = 0;

      if (response && response.data && response.data.results) {
        for (const res of response.data.results) {
          if (res.status === "applied" || res.status === "duplicate") {
            await sqliteStore.markMutationSynced(res.mutationId);
            pushedCount++;
          } else {
            errors++;
          }
        }
      }
      return { pushedCount, errors };
    } catch (err) {
      console.warn("[SyncClient] Push failed (offline or network error):", err);
      return { pushedCount: 0, errors: pending.length };
    }
  }

  /**
   * Pull server changes since last cursor
   */
  async pullChanges(): Promise<{ changesCount: number; nextCursor: number }> {
    const meta = await sqliteStore.getSyncMeta();
    const client = await this.getClient();

    try {
      const response = await client.sync.pull({ cursor: meta.serverCursor, limit: 100 });
      const data = response?.data;

      if (data && Array.isArray(data.changes)) {
        for (const change of data.changes) {
          if (change.entityType === "LEAD") {
            const lead = change.data;
            if (lead) {
              await sqliteStore.cacheLeads([
                {
                  id: lead.id,
                  name: lead.name,
                  phoneE164: lead.phoneE164,
                  stage: lead.stage?.label || "New Lead",
                  source: lead.source || "",
                  notes: lead.notes || lead.customFields?.notes || "",
                  nextFollowUpAt: lead.nextFollowUpAt || undefined,
                  cachedAt: new Date().toISOString(),
                },
              ]);
            }
          }
        }

        const nextCursor = data.nextCursor ?? meta.serverCursor;
        await sqliteStore.recordSyncSuccess(nextCursor);
        return { changesCount: data.changes.length, nextCursor };
      }

      await sqliteStore.recordSyncSuccess(meta.serverCursor);
      return { changesCount: 0, nextCursor: meta.serverCursor };
    } catch (err) {
      console.warn("[SyncClient] Pull failed (offline or network error):", err);
      return { changesCount: 0, nextCursor: meta.serverCursor };
    }
  }

  /**
   * Execute full two-way synchronization
   */
  async fullSync(): Promise<{
    pushed: number;
    pulled: number;
    leaseValid: boolean;
  }> {
    const pushResult = await this.pushOutbox();
    const pullResult = await this.pullChanges();
    const meta = await sqliteStore.getSyncMeta();

    return {
      pushed: pushResult.pushedCount,
      pulled: pullResult.changesCount,
      leaseValid: meta.isLeaseValid,
    };
  }
}
