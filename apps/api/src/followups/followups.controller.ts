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
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { FollowupsService } from "./followups.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { CreateFollowUpInput, UpdateFollowUpInput } from "@telecalling-crm/shared";

@ApiTags("followups")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("followups")
export class FollowupsController {
  constructor(private readonly followupsService: FollowupsService) {}

  @ApiOperation({ summary: "List follow-ups" })
  @Get()
  list(
    @Request() req: { user: { id: string; role?: string } },
    @Query("pendingOnly") pendingOnly?: string,
    @Query("userId") userId?: string,
  ) {
    const isManagerOrAdmin = req.user.role === "admin" || req.user.role === "manager";
    const targetUserId = userId || (isManagerOrAdmin ? undefined : req.user.id);
    return this.followupsService.list(targetUserId, pendingOnly === "true");
  }

  @ApiOperation({ summary: "Schedule follow-up for a lead" })
  @Post()
  create(@Request() req: { user: { id: string } }, @Body() body: CreateFollowUpInput) {
    return this.followupsService.create(req.user.id, body);
  }

  @ApiOperation({ summary: "Mark follow-up completed or update note/date" })
  @Patch(":id")
  update(@Param("id") id: string, @Body() body: UpdateFollowUpInput) {
    return this.followupsService.update(id, body);
  }
}
