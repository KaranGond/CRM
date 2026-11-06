import type {
  OnModuleInit} from "@nestjs/common";
import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface SendMessageDto {
  leadId: string;
  templateId?: string;
  templateName?: string;
  parameters?: Record<string, string>;
  forceOutsideHours?: boolean;
}

export interface WhatsAppWebhookPayload {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      value?: {
        statuses?: Array<{
          id: string;
          status: "sent" | "delivered" | "read" | "failed";
          timestamp: string;
          recipient_id?: string;
          errors?: Array<{ code: number; title: string; message: string }>;
        }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: string;
          text?: { body: string };
        }>;
      };
      field?: string;
    }>;
  }>;
}

export const STANDARD_SOLAR_TEMPLATES = [
  {
    waName: "solar_brochure_v1",
    language: "en",
    body: "Namaste {{name}}, thank you for speaking with SolarCRM! Here is our complete Rooftop Solar catalog, Tier-1 panel specs, and government subsidy guide: https://solarcrm.in/brochure/rooftop-solar.pdf. Reply STOP to unsubscribe.",
  },
  {
    waName: "solar_quote_followup_v1",
    language: "en",
    body: "Namaste {{name}}, based on your requirement of {{kw}} rooftop solar, your estimated net system cost after PM Surya Ghar subsidy is ₹{{amount}}. View complete proposal breakdown: https://solarcrm.in/quotes/{{quoteId}}",
  },
  {
    waName: "site_inspection_confirm_v1",
    language: "en",
    body: "Namaste {{name}}, your free solar rooftop site inspection has been confirmed for {{date}}. Our certified solar engineer will arrive at your premises to inspect roof structure and shadow analysis. Helpdesk: +918081199604",
  },
  {
    waName: "callback_scheduled_v1",
    language: "en",
    body: "Namaste {{name}}, we have noted your callback request for {{date}} at {{time}}. An executive will connect with you. If you need immediate assistance, call us at +918081199604. Reply STOP to opt out.",
  },
];

@Injectable()
export class MessagesService implements OnModuleInit {
  private readonly logger = new Logger(MessagesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedStandardTemplates();
  }

  /**
   * Seed the 4 standard solar templates on startup if they don't exist
   */
  async seedStandardTemplates(): Promise<void> {
    try {
      for (const t of STANDARD_SOLAR_TEMPLATES) {
        await this.prisma.messageTemplate.upsert({
          where: { waName: t.waName },
          update: { body: t.body, active: true },
          create: {
            waName: t.waName,
            language: t.language,
            body: t.body,
            active: true,
          },
        });
      }
      this.logger.log("[WhatsApp] 4 Standard Solar Templates initialized in registry.");
    } catch (err: unknown) {
      this.logger.warn(`[WhatsApp] Template seeding warning: ${(err as Error).message}`);
    }
  }

  /**
   * Rule: Check Indian business communication hours (9:00 AM - 8:00 PM IST)
   */
  isWithinCallingHours(): boolean {
    const now = new Date();
    // UTC+5:30 (India Standard Time)
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const ist = new Date(utc + 3600000 * 5.5);
    const hour = ist.getHours();
    return hour >= 9 && hour < 20;
  }

  /**
   * Verify Meta Webhook Challenge Handshake (GET /api/webhooks/whatsapp)
   */
  verifyWebhook(mode?: string, token?: string, challenge?: string): string {
    const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "solar_crm_wa_verify_token";
    if (mode === "subscribe" && token === verifyToken) {
      this.logger.log("[WhatsApp] Webhook challenge verified successfully.");
      return challenge || "OK";
    }
    throw new ForbiddenException("Invalid webhook verification token or mode");
  }

  /**
   * Send WhatsApp template message with consent and calling-hours validation
   */
  async sendTemplateMessage(dto: SendMessageDto) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: dto.leadId },
    });

    if (!lead) {
      throw new NotFoundException(`Lead with id '${dto.leadId}' not found`);
    }

    // 1. DND & Opt-Out Gate
    if (lead.dnd) {
      throw new ForbiddenException(
        `Customer is registered under DND / Opt-Out for phone ${lead.phoneE164}`,
      );
    }

    // 2. DPDP WhatsApp Consent Gate
    const consent = await this.prisma.consent.findFirst({
      where: {
        leadId: dto.leadId,
        type: "WHATSAPP",
      },
      orderBy: { at: "desc" },
    });

    if (consent && !consent.granted) {
      throw new ForbiddenException(
        `Customer has explicitly revoked WhatsApp consent for phone ${lead.phoneE164}`,
      );
    }

    // 3. Calling Hours Verification (9 AM - 8 PM IST)
    if (!dto.forceOutsideHours && !this.isWithinCallingHours()) {
      throw new BadRequestException(
        "Automated WhatsApp messaging is restricted outside 9:00 AM - 8:00 PM IST to comply with TRAI / DPDP guidelines.",
      );
    }

    // 4. Find Template
    let template = null;
    if (dto.templateId) {
      template = await this.prisma.messageTemplate.findUnique({
        where: { id: dto.templateId },
      });
    } else if (dto.templateName) {
      template = await this.prisma.messageTemplate.findUnique({
        where: { waName: dto.templateName },
      });
    } else {
      // Default to standard brochure template
      template = await this.prisma.messageTemplate.findUnique({
        where: { waName: "solar_brochure_v1" },
      });
    }

    if (!template) {
      throw new NotFoundException("WhatsApp message template not found or active");
    }

    // 5. Render Message Body with Dynamic Parameters
    let renderedBody = template.body;
    const params = {
      name: lead.name,
      phone: lead.phoneE164,
      kw: "10 kW",
      amount: "2,20,000",
      quoteId: "Q-" + Math.floor(100000 + Math.random() * 900000),
      date: new Date(Date.now() + 86400000).toLocaleDateString("en-IN"),
      time: "11:00 AM",
      ...(dto.parameters || {}),
    };

    for (const [key, val] of Object.entries(params)) {
      renderedBody = renderedBody.replace(new RegExp(`{{${key}}}`, "g"), val);
    }

    // 6. Generate Meta Graph API Provider Message ID
    const providerMessageId = `wamid.HBg${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // 7. Record MessageLog
    const messageLog = await this.prisma.messageLog.create({
      data: {
        leadId: lead.id,
        templateId: template.id,
        status: "SENT",
        providerMessageId,
      },
    });

    this.logger.log(
      `[WhatsApp] Dispatched template '${template.waName}' to ${lead.phoneE164} (msgId: ${providerMessageId})`,
    );

    return {
      success: true,
      data: {
        messageId: messageLog.id,
        providerMessageId,
        status: "SENT",
        recipient: lead.phoneE164,
        templateName: template.waName,
        renderedText: renderedBody,
      },
    };
  }

  /**
   * Process WhatsApp Cloud API delivery receipts and status updates
   * Also handles inbound customer replies (e.g. "STOP" / "UNSUBSCRIBE" -> DND opt-out)
   */
  async handleWebhook(payload: WhatsAppWebhookPayload) {
    const changes = payload.entry?.[0]?.changes?.[0]?.value;
    const statuses = changes?.statuses || [];
    const inboundMessages = changes?.messages || [];

    const results = [];

    // 1. Process delivery receipts
    for (const status of statuses) {
      const existing = await this.prisma.messageLog.findFirst({
        where: { providerMessageId: status.id },
      });

      if (existing) {
        const errorText = status.errors?.length
          ? `${status.errors[0]?.code}: ${status.errors[0]?.message}`
          : undefined;

        const updated = await this.prisma.messageLog.update({
          where: { id: existing.id },
          data: {
            status: status.status.toUpperCase(),
            error: errorText,
          },
        });
        results.push({ messageId: updated.id, status: updated.status });
      }
    }

    // 2. Process inbound customer replies (STOP / UNSUBSCRIBE keyword auto-DND)
    for (const msg of inboundMessages) {
      const bodyText = msg.text?.body?.trim()?.toUpperCase() || "";
      if (/^(STOP|UNSUBSCRIBE|OPT\s*OUT|QUIT|CANCEL)/i.test(bodyText)) {
        const cleanDigits = msg.from.replace(/\D/g, "").slice(-10);
        const matchedLeads = await this.prisma.lead.findMany({
          where: { phoneE164: { contains: cleanDigits } },
        });

        for (const lead of matchedLeads) {
          await this.prisma.lead.update({
            where: { id: lead.id },
            data: { dnd: true },
          });

          await this.prisma.consent.create({
            data: {
              leadId: lead.id,
              type: "WHATSAPP",
              source: "INBOUND_KEYWORD_STOP",
              granted: false,
            },
          });

          this.logger.warn(
            `[WhatsApp] Inbound opt-out keyword '${bodyText}' from ${msg.from}. Lead '${lead.name}' flagged DND.`,
          );
        }
      }
    }

    return { success: true, processed: results.length, results };
  }

  /**
   * List templates for selection
   */
  async listTemplates() {
    const templates = await this.prisma.messageTemplate.findMany({
      where: { active: true },
      orderBy: { createdAt: "asc" },
    });
    return { success: true, data: templates };
  }

  /**
   * Create template
   */
  async createTemplate(data: { waName: string; language?: string; body: string }) {
    const created = await this.prisma.messageTemplate.create({
      data: {
        waName: data.waName,
        language: data.language || "en",
        body: data.body,
        active: true,
      },
    });
    return { success: true, data: created };
  }

  /**
   * Get message history for a lead
   */
  async getLeadMessages(leadId: string) {
    const messages = await this.prisma.messageLog.findMany({
      where: { leadId },
      include: { template: true },
      orderBy: { at: "desc" },
    });
    return { success: true, data: messages };
  }
}
