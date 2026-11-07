import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import type { Prisma, CallOutcome } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  normalizePhoneE164,
  type PostCallsBatchInput,
  type UpdateCallLogDispositionInput,
} from "@telecalling-crm/shared";

import { MessagesService } from "../messages/messages.service";

@Injectable()
export class CallsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messagesService: MessagesService,
  ) {}

  /**
   * Rule 2 & 6: Batch upsert with dedupeKey. Idempotent.
   */
  async processBatch(callerId: string, input: PostCallsBatchInput) {
    const results: {
      dedupeKey: string;
      status: "created" | "duplicate" | "error";
      callId?: string;
      error?: string;
    }[] = [];

    for (const call of input.calls) {
      try {
        const normPhone = normalizePhoneE164(call.numberE164);

        // Auto-match lead by normalized phone or verify existing leadId
        let leadId = call.leadId;
        if (leadId) {
          const exists = await this.prisma.lead.findUnique({ where: { id: leadId } });
          if (!exists) leadId = undefined;
        }
        if (!leadId && normPhone) {
          let matchedLead = await this.prisma.lead.findUnique({
            where: { phoneE164: normPhone },
          });
          if (!matchedLead) {
            matchedLead = await this.prisma.lead.findFirst({
              where: { altPhones: { has: normPhone } },
            });
          }
          if (matchedLead) leadId = matchedLead.id;
        }

        let dispositionId = call.dispositionId;
        if (dispositionId) {
          let dispType = await this.prisma.dispositionType.findUnique({
            where: { id: dispositionId },
          });
          if (!dispType) {
            dispType = await this.prisma.dispositionType.findFirst({
              where: { label: { equals: dispositionId, mode: "insensitive" } },
            });
          }
          dispositionId = dispType?.id ?? null;
        }

        let deviceId = call.deviceId;
        if (deviceId) {
          const deviceExists = await this.prisma.device.findUnique({ where: { id: deviceId } });
          if (!deviceExists) {
            await this.prisma.device.create({
              data: {
                id: deviceId,
                userId: callerId,
                model: "Mobile Device",
                androidVersion: "Android",
                appVersion: "1.0.0",
                engineVersion: "1.0.0",
              },
            });
          }
        } else {
          const userDevice = await this.prisma.device.findFirst({ where: { userId: callerId } });
          if (userDevice) {
            deviceId = userDevice.id;
          } else {
            deviceId = `device-${callerId.slice(0, 8)}`;
            await this.prisma.device.create({
              data: {
                id: deviceId,
                userId: callerId,
                model: "Mobile Device",
                androidVersion: "Android",
                appVersion: "1.0.0",
                engineVersion: "1.0.0",
              },
            });
          }
        }

        const existing = await this.prisma.callLog.findUnique({
          where: {
            callerId_dedupeKey: {
              callerId,
              dedupeKey: call.dedupeKey,
            },
          },
        });

        if (existing) {
          results.push({
            dedupeKey: call.dedupeKey,
            status: "duplicate",
            callId: existing.id,
          });
          continue;
        }

        const created = await this.prisma.callLog.create({
          data: {
            id: call.id,
            leadId,
            callerId,
            deviceId: deviceId,
            channel: call.channel ?? "SIM",
            provider: call.provider,
            providerCallId: call.providerCallId,
            dedupeKey: call.dedupeKey,
            direction: call.direction ?? "OUTBOUND",
            numberE164: normPhone,
            startedAt: new Date(call.startedAt),
            endedAt: new Date(call.endedAt),
            durationSec: call.durationSec,
            outcome: call.outcome,
            sim: call.sim,
            dispositionId,
            remark: call.remark,
            followUpAt: call.followUpAt ? new Date(call.followUpAt) : null,
            recordingId: call.recordingId,
            recordingStatus:
              call.recordingStatus ??
              (call.recordingId
                ? "MATCHED"
                : call.durationSec < 10 || call.outcome !== "CONNECTED"
                  ? "NOT_APPLICABLE"
                  : "PENDING"),
            origin: call.origin ?? "ENGINE",
          },
        });

        // Record change feed
        await this.prisma.syncChangeFeed.create({
          data: {
            entityType: "CALL",
            entityId: created.id,
            operation: "INSERT",
            dataJson: JSON.parse(JSON.stringify(created)),
          },
        });

        results.push({
          dedupeKey: call.dedupeKey,
          status: "created",
          callId: created.id,
        });
      } catch (err) {
        results.push({
          dedupeKey: call.dedupeKey,
          status: "error",
          error: (err as Error).message,
        });
      }
    }

    return {
      success: true,
      data: {
        processed: results.length,
        results,
      },
    };
  }

  async reconcile(callerId: string, input: PostCallsBatchInput) {
    const batchResult = await this.processBatch(callerId, {
      calls: input.calls.map((c) => ({ ...c, origin: "RECONCILE" })),
    });

    return {
      success: true,
      data: {
        reconciled: batchResult.data.processed,
        results: batchResult.data.results,
      },
    };
  }

  async getLeadAssignee(leadId: string) {
    return this.prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, assigneeId: true },
    });
  }

  async updateDisposition(
    id: string,
    data: UpdateCallLogDispositionInput,
    user?: { id: string; role?: string },
  ) {
    let call = await this.prisma.callLog.findUnique({
      where: { id },
      include: { disposition: true },
    });

    if (!call) {
      call = await this.prisma.callLog.findFirst({
        where: { dedupeKey: id },
        include: { disposition: true },
      });
    }

    if (!call) {
      throw new NotFoundException(`Call ${id} not found`);
    }

    if (user?.role === "telecaller" && call.callerId !== user.id) {
      throw new ForbiddenException("Access denied: You cannot modify disposition for another caller's call");
    }

    let dispositionType = await this.prisma.dispositionType.findUnique({
      where: { id: data.dispositionId },
    });
    if (!dispositionType) {
      dispositionType = await this.prisma.dispositionType.findFirst({
        where: { label: { equals: data.dispositionId, mode: "insensitive" } },
      });
    }
    const finalDispositionId = dispositionType ? dispositionType.id : null;

    const updated = await this.prisma.callLog.update({
      where: { id: call.id },
      data: {
        dispositionId: finalDispositionId,
        remark: data.remark ?? call.remark,
        followUpAt: data.followUpAt ? new Date(data.followUpAt) : call.followUpAt,
      },
      include: { disposition: true, lead: true },
    });

    // Update lead's stage and follow up if configured
    if (call.leadId && dispositionType) {
      if (dispositionType.setsStageId) {
        await this.prisma.lead.update({
          where: { id: call.leadId },
          data: {
            stageId: dispositionType.setsStageId,
            nextFollowUpAt: data.followUpAt ? new Date(data.followUpAt) : undefined,
          },
        });
      }

      if (data.followUpAt) {
        await this.prisma.followUp.create({
          data: {
            leadId: call.leadId,
            userId: call.callerId,
            dueAt: new Date(data.followUpAt),
            note: data.remark ?? `Follow-up after call (${dispositionType.label})`,
          },
        });
      }

      // Rule: Auto-trigger WhatsApp template follow-up if disposition has templateId configured
      if (dispositionType.templateId) {
        try {
          await this.messagesService.sendTemplateMessage({
            leadId: call.leadId,
            templateId: dispositionType.templateId,
            parameters: {
              remark: data.remark || "",
              disposition: dispositionType.label,
            },
          });
        } catch (err: unknown) {
          // Log without interrupting disposition save
          console.warn(`[Auto-WhatsApp] Template send skipped: ${(err as Error).message}`);
        }
      }
    }

    await this.prisma.syncChangeFeed.create({
      data: {
        entityType: "CALL",
        entityId: updated.id,
        operation: "UPDATE",
        dataJson: JSON.parse(JSON.stringify(updated)),
      },
    });

    return { success: true, data: updated };
  }

  async listLeadCalls(leadId: string) {
    const calls = await this.prisma.callLog.findMany({
      where: { leadId },
      orderBy: { startedAt: "desc" },
      include: {
        disposition: true,
        caller: { select: { id: true, name: true } },
        recording: true,
      },
    });
    return { success: true, data: calls };
  }

  async listCalls(params?: {
    page?: number;
    limit?: number;
    callerId?: string;
    leadId?: string;
    outcome?: string;
  }) {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.CallLogWhereInput = {};
    if (params?.callerId) where.callerId = params.callerId;
    if (params?.leadId) where.leadId = params.leadId;
    if (params?.outcome) where.outcome = params.outcome as CallOutcome;

    const [total, calls] = await Promise.all([
      this.prisma.callLog.count({ where }),
      this.prisma.callLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startedAt: "desc" },
        include: {
          disposition: true,
          caller: { select: { id: true, name: true } },
          lead: { select: { id: true, name: true, phoneE164: true } },
          recording: true,
        },
      }),
    ]);

    return {
      success: true,
      data: calls,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
