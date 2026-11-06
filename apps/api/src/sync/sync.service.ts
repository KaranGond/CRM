import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CallsService } from "../calls/calls.service";
import { FollowupsService } from "../followups/followups.service";
import { LeadsService } from "../leads/leads.service";
import { MessagesService } from "../messages/messages.service";
import type {
  SyncPullQuery,
  SyncPushInput,
  SyncPushResult,
  SyncPullResponse,
} from "@telecalling-crm/shared";

@Injectable()
export class SyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly callsService: CallsService,
    private readonly followupsService: FollowupsService,
    private readonly leadsService: LeadsService,
    private readonly messagesService: MessagesService,
  ) {}

  async pull(query?: SyncPullQuery): Promise<{ success: boolean; data: SyncPullResponse }> {
    const cursor = parseInt(String(query?.cursor ?? 0), 10) || 0;
    const limit = parseInt(String(query?.limit ?? 100), 10) || 100;

    const changes = await this.prisma.syncChangeFeed.findMany({
      where: { seq: { gt: cursor } },
      orderBy: { seq: "asc" },
      take: limit + 1,
    });

    const hasMore = changes.length > limit;
    const resultChanges = hasMore ? changes.slice(0, limit) : changes;
    const nextCursor =
      resultChanges.length > 0 && resultChanges[resultChanges.length - 1]
        ? resultChanges[resultChanges.length - 1]!.seq
        : cursor;

    return {
      success: true,
      data: {
        nextCursor,
        hasMore,
        serverTimestamp: new Date().toISOString(),
        changes: resultChanges.map((c) => ({
          seq: c.seq,
          entityType: c.entityType,
          entityId: c.entityId,
          operation: c.operation,
          data: c.dataJson,
        })),
      },
    };
  }

  async push(userId: string, input: SyncPushInput) {
    const results: SyncPushResult[] = [];

    for (const mutation of input.mutations) {
      try {
        const mutationType = mutation.type || (mutation as any).mutationType;
        switch (mutationType) {
          case "CALL_CAPTURED": {
            const batchResult = await this.callsService.processBatch(userId, {
              calls: [
                {
                  ...mutation.payload,
                  deviceId: input.deviceId,
                } as any,
              ],
            });
            const status = batchResult.data.results[0]?.status ?? "error";
            const mappedStatus: "applied" | "duplicate" | "rejected" =
              status === "created" ? "applied" : status === "duplicate" ? "duplicate" : "rejected";
            results.push({
              mutationId: mutation.mutationId,
              status: mappedStatus,
            });
            break;
          }

          case "DISPOSITION_SAVED": {
            const { callId, dispositionId, remark, followUpAt, sendWhatsApp, templateId } = mutation.payload;
            const updated = await this.callsService.updateDisposition(callId, {
              dispositionId,
              remark,
              followUpAt,
            });

            // Automated WhatsApp template dispatch if requested or configured
            if ((sendWhatsApp || templateId) && updated.data?.leadId) {
              try {
                await this.messagesService.sendTemplateMessage({
                  leadId: updated.data.leadId,
                  templateId,
                });
              } catch (waErr: any) {
                console.warn(`[SyncService] WhatsApp auto-dispatch note: ${waErr.message}`);
              }
            }

            results.push({
              mutationId: mutation.mutationId,
              status: "applied",
              serverRecord: updated.data,
            });
            break;
          }

          case "FOLLOWUP_DONE": {
            const { followUpId } = mutation.payload;
            const updated = await this.followupsService.update(followUpId, {
              done: true,
            });
            results.push({
              mutationId: mutation.mutationId,
              status: "applied",
              serverRecord: updated.data,
            });
            break;
          }

          case "FOLLOWUP_CREATED": {
            const { leadId, dueAt, note } = mutation.payload;
            const created = await this.followupsService.create(userId, {
              leadId,
              dueAt,
              note,
            });
            results.push({
              mutationId: mutation.mutationId,
              status: "applied",
              serverRecord: created.data,
            });
            break;
          }

          case "LEAD_CREATED": {
            const { name, phoneE164, source, stage, notes } = mutation.payload;
            let stageId: string | undefined = undefined;
            if (stage) {
              const matchedStage = await this.prisma.pipelineStage.findFirst({
                where: { label: { equals: stage, mode: "insensitive" } },
              });
              if (matchedStage) stageId = matchedStage.id;
            }
            const created = await this.leadsService.createLead({
              name,
              phoneE164,
              altPhones: [],
              dnd: false,
              source: source || "Mobile App",
              stageId,
              assigneeId: userId,
              customFields: notes ? { notes } : {},
            });
            results.push({
              mutationId: mutation.mutationId,
              status: "applied",
              serverRecord: created.data,
            });
            break;
          }

          case "LEAD_UPDATED": {
            const { leadId, ...fields } = mutation.payload;
            let customFields = fields.customFields || {};
            if (fields.notes) {
              customFields = { ...customFields, notes: fields.notes };
            }
            let stageId = fields.stageId;
            if (!stageId && fields.stage) {
              const matchedStage = await this.prisma.pipelineStage.findFirst({
                where: { label: { equals: fields.stage, mode: "insensitive" } },
              });
              if (matchedStage) stageId = matchedStage.id;
            }
            const updatePayload: any = { ...fields };
            if (stageId) updatePayload.stageId = stageId;
            if (Object.keys(customFields).length > 0) updatePayload.customFields = customFields;
            if (fields.nextFollowUpAt) updatePayload.nextFollowUpAt = fields.nextFollowUpAt;

            const updated = await this.leadsService.updateLead(leadId, updatePayload);
            results.push({
              mutationId: mutation.mutationId,
              status: "applied",
              serverRecord: updated.data,
            });
            break;
          }

          default:
            results.push({
              mutationId: mutation.mutationId,
              status: "rejected",
              error: `Unknown mutation type: ${mutation.type}`,
            });
        }
      } catch (err: any) {
        results.push({
          mutationId: mutation.mutationId,
          status: "rejected",
          error: err.message || "Failed to process mutation",
        });
      }
    }

    return {
      success: true,
      data: {
        results,
      },
    };
  }
}
