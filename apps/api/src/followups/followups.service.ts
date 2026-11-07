import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateFollowUpInput, UpdateFollowUpInput } from "@telecalling-crm/shared";

@Injectable()
export class FollowupsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, data: CreateFollowUpInput) {
    const lead = await this.prisma.lead.findUnique({ where: { id: data.leadId } });
    if (!lead) {
      throw new NotFoundException(`Lead ${data.leadId} not found`);
    }

    const followUp = await this.prisma.followUp.create({
      data: {
        leadId: data.leadId,
        userId,
        dueAt: new Date(data.dueAt),
        note: data.note,
      },
      include: { lead: true },
    });

    // Update lead's nextFollowUpAt
    await this.prisma.lead.update({
      where: { id: data.leadId },
      data: { nextFollowUpAt: new Date(data.dueAt) },
    });

    await this.prisma.syncChangeFeed.create({
      data: {
        entityType: "FOLLOWUP",
        entityId: followUp.id,
        operation: "INSERT",
        dataJson: JSON.parse(JSON.stringify(followUp)),
      },
    });

    return { success: true, data: followUp };
  }

  async list(userId?: string, pendingOnly = false) {
    const where: Prisma.FollowUpWhereInput = {};
    if (userId) {
      where.userId = userId;
    }
    if (pendingOnly) {
      where.doneAt = null;
    }

    const followUps = await this.prisma.followUp.findMany({
      where,
      orderBy: { dueAt: "asc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        lead: {
          select: {
            id: true,
            name: true,
            phoneE164: true,
            stage: true,
          },
        },
      },
    });

    return { success: true, data: followUps };
  }

  async update(id: string, data: UpdateFollowUpInput, user?: { id: string; role?: string }) {
    const existing = await this.prisma.followUp.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`FollowUp ${id} not found`);
    }

    if (user?.role === "telecaller" && existing.userId !== user.id) {
      throw new ForbiddenException("Access denied: You cannot modify another caller's follow-up task");
    }

    const updated = await this.prisma.followUp.update({
      where: { id },
      data: {
        dueAt: data.dueAt ? new Date(data.dueAt) : existing.dueAt,
        note: data.note ?? existing.note,
        doneAt: data.done === true ? new Date() : data.done === false ? null : existing.doneAt,
      },
      include: { lead: true },
    });

    await this.prisma.syncChangeFeed.create({
      data: {
        entityType: "FOLLOWUP",
        entityId: updated.id,
        operation: "UPDATE",
        dataJson: JSON.parse(JSON.stringify(updated)),
      },
    });

    return { success: true, data: updated };
  }
}
