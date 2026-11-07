import { Injectable, ConflictException, NotFoundException, BadRequestException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  normalizePhoneE164,
  type CreateLeadInput,
  type UpdateLeadInput,
  type AssignLeadInput,
  type BulkAssignLeadInput,
  type ImportLeadsInput,
} from "@telecalling-crm/shared";

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  async createLead(data: CreateLeadInput) {
    const normalizedPhone = normalizePhoneE164(data.phoneE164);
    if (!normalizedPhone || normalizedPhone.length < 10) {
      throw new BadRequestException(`Invalid phone number: ${data.phoneE164}`);
    }

    const existing = await this.prisma.lead.findUnique({
      where: { phoneE164: normalizedPhone },
    });
    if (existing) {
      throw new ConflictException(`Lead with phone number ${normalizedPhone} already exists`);
    }

    const lead = await this.prisma.lead.create({
      data: {
        name: data.name,
        phoneE164: normalizedPhone,
        altPhones: data.altPhones ?? [],
        source: data.source ?? "manual",
        stageId: data.stageId,
        assigneeId: data.assigneeId,
        nextFollowUpAt: data.nextFollowUpAt ? new Date(data.nextFollowUpAt) : undefined,
        customFields: data.customFields ?? undefined,
        dnd: data.dnd ?? false,
      },
      include: { stage: true, assignee: true },
    });

    // Record change feed
    await this.prisma.syncChangeFeed.create({
      data: {
        entityType: "LEAD",
        entityId: lead.id,
        operation: "INSERT",
        dataJson: JSON.parse(JSON.stringify(lead)),
      },
    });

    return { success: true, data: lead };
  }

  async listLeads(params?: {
    page?: number;
    limit?: number;
    stageId?: string;
    assigneeId?: string;
    search?: string;
  }) {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.LeadWhereInput = {};
    if (params?.stageId) where.stageId = params.stageId;
    if (params?.assigneeId) where.assigneeId = params.assigneeId;
    if (params?.search) {
      where.OR = [
        { name: { contains: params.search, mode: "insensitive" } },
        { phoneE164: { contains: params.search } },
      ];
    }

    const [total, leads] = await Promise.all([
      this.prisma.lead.count({ where }),
      this.prisma.lead.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { stage: true, assignee: true },
      }),
    ]);

    return {
      success: true,
      data: leads,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getLeadById(id: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: {
        stage: true,
        assignee: true,
        calls: { orderBy: { startedAt: "desc" }, take: 10 },
        followUps: { orderBy: { dueAt: "asc" } },
        messages: { orderBy: { at: "desc" }, include: { template: true }, take: 10 },
        consents: { orderBy: { at: "desc" }, take: 5 },
        assignments: {
          orderBy: { at: "desc" },
          include: { fromUser: true, toUser: true },
        },
      },
    });

    if (!lead) {
      throw new NotFoundException(`Lead ${id} not found`);
    }

    return { success: true, data: lead };
  }

  async updateLead(id: string, data: UpdateLeadInput) {
    const existing = await this.prisma.lead.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Lead ${id} not found`);
    }

    const updated = await this.prisma.lead.update({
      where: { id },
      data: {
        name: data.name ?? existing.name,
        phoneE164: data.phoneE164 ? normalizePhoneE164(data.phoneE164) : existing.phoneE164,
        altPhones: data.altPhones ?? existing.altPhones,
        source: data.source ?? existing.source,
        stageId: data.stageId ?? existing.stageId,
        assigneeId: data.assigneeId ?? existing.assigneeId,
        nextFollowUpAt: data.nextFollowUpAt
          ? new Date(data.nextFollowUpAt)
          : existing.nextFollowUpAt,
        customFields: data.customFields ?? existing.customFields ?? undefined,
        dnd: data.dnd ?? existing.dnd,
      },
      include: { stage: true, assignee: true },
    });

    await this.prisma.syncChangeFeed.create({
      data: {
        entityType: "LEAD",
        entityId: updated.id,
        operation: "UPDATE",
        dataJson: JSON.parse(JSON.stringify(updated)),
      },
    });

    return { success: true, data: updated };
  }

  async assignLead(leadId: string, fromUserId: string | null, data: AssignLeadInput) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      throw new NotFoundException(`Lead ${leadId} not found`);
    }

    const [updatedLead] = await this.prisma.$transaction([
      this.prisma.lead.update({
        where: { id: leadId },
        data: { assigneeId: data.toUserId },
        include: { stage: true, assignee: true },
      }),
      this.prisma.leadAssignment.create({
        data: {
          leadId,
          fromUserId: fromUserId ?? lead.assigneeId,
          toUserId: data.toUserId,
          reason: data.reason ?? "Manual reassignment",
        },
      }),
    ]);

    await this.prisma.syncChangeFeed.create({
      data: {
        entityType: "LEAD",
        entityId: updatedLead.id,
        operation: "UPDATE",
        dataJson: JSON.parse(JSON.stringify(updatedLead)),
      },
    });

    return { success: true, data: updatedLead };
  }

  async bulkAssign(fromUserId: string | null, data: BulkAssignLeadInput) {
    const leads = await this.prisma.lead.findMany({
      where: { id: { in: data.leadIds } },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.lead.updateMany({
        where: { id: { in: data.leadIds } },
        data: { assigneeId: data.toUserId },
      });

      for (const lead of leads) {
        await tx.leadAssignment.create({
          data: {
            leadId: lead.id,
            fromUserId: fromUserId ?? lead.assigneeId,
            toUserId: data.toUserId,
            reason: data.reason ?? "Bulk assignment",
          },
        });
      }
    });

    return { success: true, data: { count: data.leadIds.length } };
  }

  /**
   * Rule 7 (PLAN.md): Server-computed queue order.
   * Due follow-ups first, then new leads by priority and age.
   * Skip DND leads.
   */
  async getCallerQueue(userId: string, limit = 50) {
    const leads = await this.prisma.lead.findMany({
      where: {
        assigneeId: userId,
        dnd: false,
      },
      take: limit,
      orderBy: [{ nextFollowUpAt: "asc" }, { createdAt: "asc" }],
      include: {
        stage: true,
        followUps: {
          where: { doneAt: null },
          orderBy: { dueAt: "asc" },
          take: 1,
        },
      },
    });

    return { success: true, data: leads };
  }

  async importLeads(actorId: string, data: ImportLeadsInput) {
    const importJob = await this.prisma.importJob.create({
      data: {
        fileKey: `import-${Date.now()}`,
        status: "PROCESSING",
      },
    });

    let activeTelecallers: { id: string; name: string }[] = [];
    if (data.autoRoundRobin) {
      activeTelecallers = await this.prisma.user.findMany({
        where: { role: "telecaller", active: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });
    }

    let defaultStage = await this.prisma.pipelineStage.findFirst({
      where: { active: true },
      orderBy: { order: "asc" },
    });

    let imported = 0;
    let duplicates = 0;
    const errors: string[] = [];
    let rrIndex = 0;

    for (const item of data.leads) {
      try {
        const normalized = normalizePhoneE164(item.phone);
        if (!normalized || normalized.length < 10) {
          errors.push(`Lead ${item.name} (${item.phone}): Invalid phone number`);
          continue;
        }
        const existing = await this.prisma.lead.findUnique({
          where: { phoneE164: normalized },
        });

        if (existing) {
          duplicates++;
          continue;
        }

        const stageId = item.stageId ?? data.defaultStageId ?? defaultStage?.id ?? null;
        let assigneeId = item.assigneeId ?? data.defaultAssigneeId ?? null;

        if (!assigneeId && data.autoRoundRobin && activeTelecallers.length > 0) {
          const telecaller = activeTelecallers[rrIndex % activeTelecallers.length];
          if (telecaller) {
            assigneeId = telecaller.id;
            rrIndex++;
          }
        }

        const lead = await this.prisma.lead.create({
          data: {
            name: item.name.trim(),
            phoneE164: normalized,
            altPhones: item.altPhones ?? [],
            source: item.source ?? "csv_import",
            stageId,
            assigneeId,
            customFields: item.customFields ?? (item.notes ? { notes: item.notes } : undefined),
          },
        });

        if (assigneeId) {
          await this.prisma.leadAssignment.create({
            data: {
              leadId: lead.id,
              fromUserId: actorId,
              toUserId: assigneeId,
              reason: data.autoRoundRobin ? "Auto round-robin import" : "Import assignment",
            },
          });
        }

        await this.prisma.syncChangeFeed.create({
          data: {
            entityType: "LEAD",
            entityId: lead.id,
            operation: "INSERT",
            dataJson: JSON.parse(JSON.stringify(lead)),
          },
        });

        imported++;
      } catch (err: unknown) {
        errors.push(`Lead ${item.name} (${item.phone}): ${(err as Error).message}`);
      }
    }

    await this.prisma.importJob.update({
      where: { id: importJob.id },
      data: {
        status: errors.length > 0 && imported === 0 ? "FAILED" : "COMPLETED",
        counts: {
          total: data.leads.length,
          imported,
          duplicates,
          errors: errors.length,
        },
        errors: errors.length > 0 ? errors : undefined,
      },
    });

    return {
      success: true,
      data: {
        jobId: importJob.id,
        total: data.leads.length,
        imported,
        duplicates,
        errors,
      },
    };
  }
}
