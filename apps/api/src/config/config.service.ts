import type { OnModuleInit } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { CreatePipelineStageInput, CreateDispositionTypeInput } from "@telecalling-crm/shared";

@Injectable()
export class ConfigService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedDefaultsIfEmpty();
  }

  async getAppConfig() {
    const configs = await this.prisma.config.findMany();
    const configMap: Record<string, unknown> = {};
    for (const item of configs) {
      configMap[item.key] = item.valueJson;
    }

    // Default configuration if not customized
    const merged = {
      callGapSec: 5,
      offlineLeaseHours: 72,
      whatsappCutoffHours: 6,
      maxBatchSize: 50,
      supportedBrands: [
        "Samsung",
        "Xiaomi",
        "Redmi",
        "Poco",
        "Vivo",
        "iQOO",
        "Oppo",
        "Realme",
        "OnePlus",
      ],
      recorderPathPatterns: {
        Samsung: ["Recordings/Call", "Sounds/Call", "Call"],
        Xiaomi: ["MIUI/sound_recorder/call_rec", "sound_recorder/call_rec"],
        Redmi: ["MIUI/sound_recorder/call_rec", "sound_recorder/call_rec"],
        Poco: ["MIUI/sound_recorder/call_rec", "sound_recorder/call_rec"],
        Vivo: ["Record/Call", "Recordings/Call"],
        iQOO: ["Record/Call", "Recordings/Call"],
        Oppo: ["Recordings/Call Recordings", "Record/Call", "Music/Recordings/Call Recordings"],
        Realme: ["Recordings/Call Recordings", "Record/Call"],
        OnePlus: ["Recordings/Call Recordings", "Record/Call"],
        Generic: ["Recordings/Call", "Record/Call"],
      },
      ...configMap,
    };

    return { success: true, data: merged };
  }

  async listStages() {
    const stages = await this.prisma.pipelineStage.findMany({
      where: { active: true },
      orderBy: { order: "asc" },
    });
    return { success: true, data: stages };
  }

  async createStage(data: CreatePipelineStageInput) {
    const stage = await this.prisma.pipelineStage.create({
      data: {
        label: data.label,
        order: data.order ?? 0,
        active: data.active ?? true,
      },
    });
    return { success: true, data: stage };
  }

  async listDispositions() {
    const dispositions = await this.prisma.dispositionType.findMany({
      where: { active: true },
      orderBy: { order: "asc" },
    });
    return { success: true, data: dispositions };
  }

  async createDisposition(data: CreateDispositionTypeInput) {
    const disposition = await this.prisma.dispositionType.create({
      data: {
        label: data.label,
        order: data.order ?? 0,
        active: data.active ?? true,
        setsStageId: data.setsStageId,
        requiresFollowUp: data.requiresFollowUp ?? false,
        templateId: data.templateId,
      },
    });
    return { success: true, data: disposition };
  }

  private async seedDefaultsIfEmpty() {
    const stageCount = await this.prisma.pipelineStage.count();
    if (stageCount === 0) {
      const defaultStages = [
        { label: "New Lead", order: 1 },
        { label: "Contacted", order: 2 },
        { label: "Follow Up Scheduled", order: 3 },
        { label: "Qualified", order: 4 },
        { label: "Converted", order: 5 },
        { label: "Lost / Closed", order: 6 },
      ];
      for (const stage of defaultStages) {
        await this.prisma.pipelineStage.create({ data: stage });
      }
    }

    const dispCount = await this.prisma.dispositionType.count();
    if (dispCount === 0) {
      const followUpStage = await this.prisma.pipelineStage.findFirst({
        where: { label: "Follow Up Scheduled" },
      });
      const convertedStage = await this.prisma.pipelineStage.findFirst({
        where: { label: "Converted" },
      });
      const lostStage = await this.prisma.pipelineStage.findFirst({
        where: { label: "Lost / Closed" },
      });

      const defaultDisps = [
        { label: "Interested", order: 1, requiresFollowUp: true, setsStageId: followUpStage?.id },
        {
          label: "Deal Closed / Converted",
          order: 2,
          requiresFollowUp: false,
          setsStageId: convertedStage?.id,
        },
        {
          label: "Callback Requested",
          order: 3,
          requiresFollowUp: true,
          setsStageId: followUpStage?.id,
        },
        { label: "Ringing / No Answer", order: 4, requiresFollowUp: true },
        { label: "Busy / Line Engaged", order: 5, requiresFollowUp: true },
        { label: "Not Interested", order: 6, requiresFollowUp: false, setsStageId: lostStage?.id },
        { label: "Wrong Number", order: 7, requiresFollowUp: false, setsStageId: lostStage?.id },
      ];

      for (const disp of defaultDisps) {
        await this.prisma.dispositionType.create({ data: disp });
      }
    }
  }
}
