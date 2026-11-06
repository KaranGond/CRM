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
import { CallsService } from "./calls.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { PostCallsBatchInput, UpdateCallLogDispositionInput } from "@telecalling-crm/shared";

@ApiTags("calls")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class CallsController {
  constructor(private readonly callsService: CallsService) {}

  @ApiOperation({ summary: "Post batch of captured calls (idempotent with dedupeKey)" })
  @Post("calls")
  batchPost(@Request() req: any, @Body() body: PostCallsBatchInput) {
    return this.callsService.processBatch(req.user.id, body);
  }

  @ApiOperation({ summary: "Reconcile calls found in system call log" })
  @Post("calls/reconcile")
  reconcile(@Request() req: any, @Body() body: PostCallsBatchInput) {
    return this.callsService.reconcile(req.user.id, body);
  }

  @ApiOperation({ summary: "Update call disposition, remark, and scheduled follow-up" })
  @Patch("calls/:id")
  updateDisposition(@Param("id") id: string, @Body() body: UpdateCallLogDispositionInput) {
    return this.callsService.updateDisposition(id, body);
  }

  @Post("calls/:id/disposition")
  postDisposition(@Param("id") id: string, @Body() body: UpdateCallLogDispositionInput) {
    return this.callsService.updateDisposition(id, body);
  }

  @Patch("calls/:id/disposition")
  patchDisposition(@Param("id") id: string, @Body() body: UpdateCallLogDispositionInput) {
    return this.callsService.updateDisposition(id, body);
  }

  @ApiOperation({ summary: "Get call history for a lead" })
  @Get("leads/:id/calls")
  getLeadCalls(@Param("id") leadId: string) {
    return this.callsService.listLeadCalls(leadId);
  }

  @ApiOperation({ summary: "List calls with pagination" })
  @Get("calls")
  list(
    @Request() req: any,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
    @Query("callerId") callerId?: string,
    @Query("leadId") leadId?: string,
    @Query("outcome") outcome?: string,
  ) {
    const user = req.user;
    // Security: telecaller can only view their own calls
    const effectiveCallerId = user?.role === "telecaller" ? user.id : callerId;
    return this.callsService.listCalls({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      callerId: effectiveCallerId,
      leadId,
      outcome,
    });
  }
}
