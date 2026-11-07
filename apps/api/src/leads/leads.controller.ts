import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { LeadsService } from "./leads.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type {
  CreateLeadInput,
  UpdateLeadInput,
  AssignLeadInput,
  BulkAssignLeadInput,
  ImportLeadsInput,
} from "@telecalling-crm/shared";

@ApiTags("leads")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @ApiOperation({ summary: "Import leads in bulk with dedupe and auto round-robin assignment" })
  @Post("leads/import")
  importLeads(@Request() req: { user: { id: string } }, @Body() body: ImportLeadsInput) {
    return this.leadsService.importLeads(req.user.id, body);
  }

  @ApiOperation({ summary: "Get telecaller's priority call queue" })
  @Get("me/queue")
  getQueue(@Request() req: { user: { id: string } }, @Query("limit") limit?: number) {
    return this.leadsService.getCallerQueue(req.user.id, limit ? Number(limit) : 50);
  }

  @ApiOperation({ summary: "List leads with pagination and filters" })
  @Get("leads")
  list(
    @Request() req: { user: { id: string; role?: string } },
    @Query("page") page?: number,
    @Query("limit") limit?: number,
    @Query("stageId") stageId?: string,
    @Query("assigneeId") assigneeId?: string,
    @Query("search") search?: string,
  ) {
    const user = req.user;
    // Security: telecaller can only view leads assigned to them
    const effectiveAssigneeId = user?.role === "telecaller" ? user.id : assigneeId;
    return this.leadsService.listLeads({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      stageId,
      assigneeId: effectiveAssigneeId,
      search,
    });
  }

  @ApiOperation({ summary: "Get lead by ID with call history and timeline" })
  @Get("leads/:id")
  async getById(@Request() req: { user?: { id: string; role?: string } }, @Param("id") id: string) {
    const res = await this.leadsService.getLeadById(id);
    const user = req.user;
    if (user?.role === "telecaller" && res.data.assigneeId && res.data.assigneeId !== user.id) {
      throw new ForbiddenException("Access denied: Lead is assigned to another telecaller");
    }
    return res;
  }

  @ApiOperation({ summary: "Create lead with phone deduplication" })
  @Post("leads")
  create(@Body() body: CreateLeadInput) {
    return this.leadsService.createLead(body);
  }

  @ApiOperation({ summary: "Update lead details" })
  @Patch("leads/:id")
  update(@Param("id") id: string, @Body() body: UpdateLeadInput) {
    return this.leadsService.updateLead(id, body);
  }

  @ApiOperation({ summary: "Assign lead to telecaller" })
  @Post("leads/:id/assign")
  assign(@Request() req: { user: { id: string } }, @Param("id") id: string, @Body() body: AssignLeadInput) {
    return this.leadsService.assignLead(id, req.user.id, body);
  }

  @ApiOperation({ summary: "Bulk assign leads" })
  @Post("leads/bulk-assign")
  bulkAssign(@Request() req: { user: { id: string } }, @Body() body: BulkAssignLeadInput) {
    return this.leadsService.bulkAssign(req.user.id, body);
  }
}
