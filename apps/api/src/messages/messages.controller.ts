import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { MessagesService, SendMessageDto, WhatsAppWebhookPayload } from "./messages.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@ApiTags("Messages")
@Controller()
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post("messages/send")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Send WhatsApp template message with consent checks" })
  async sendMessage(@Body() dto: SendMessageDto) {
    return this.messagesService.sendTemplateMessage(dto);
  }

  @Get("messages/templates")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "List available WhatsApp templates" })
  async listTemplates() {
    return this.messagesService.listTemplates();
  }

  @Post("messages/templates")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create a WhatsApp template" })
  async createTemplate(@Body() body: { waName: string; language?: string; body: string }) {
    return this.messagesService.createTemplate(body);
  }

  @Get("messages/lead/:leadId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get WhatsApp message history for a lead" })
  async getLeadMessages(@Param("leadId") leadId: string) {
    return this.messagesService.getLeadMessages(leadId);
  }

  @Get("webhooks/whatsapp")
  @ApiOperation({ summary: "Meta webhook challenge verification handshake" })
  @ApiQuery({ name: "hub.mode", required: false })
  @ApiQuery({ name: "hub.verify_token", required: false })
  @ApiQuery({ name: "hub.challenge", required: false })
  verifyWebhook(
    @Query("hub.mode") mode?: string,
    @Query("hub.verify_token") token?: string,
    @Query("hub.challenge") challenge?: string,
  ) {
    return this.messagesService.verifyWebhook(mode, token, challenge);
  }

  @Post("webhooks/whatsapp")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Webhook endpoint for WhatsApp delivery receipts & inbound messages" })
  async handleWebhook(@Body() payload: WhatsAppWebhookPayload) {
    return this.messagesService.handleWebhook(payload);
  }
}
