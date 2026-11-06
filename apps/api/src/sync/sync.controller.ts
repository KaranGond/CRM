import { Controller, Get, Post, Body, Query, UseGuards, Request } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { SyncService } from "./sync.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { SyncPullQuery, SyncPushInput } from "@telecalling-crm/shared";

@ApiTags("sync")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("sync")
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @ApiOperation({
    summary: "Pull changes feed since cursor (Section 9 Offline Sync)",
  })
  @Get("pull")
  pull(@Query() query: SyncPullQuery) {
    return this.syncService.pull(query);
  }

  @ApiOperation({
    summary: "Push offline mutations outbox with per-mutation result",
  })
  @Post("push")
  push(@Request() req: any, @Body() body: SyncPushInput) {
    return this.syncService.push(req.user.id, body);
  }
}
