import { Controller, Get, UseGuards, Request, Query, ForbiddenException } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { ReportsService } from "./reports.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@ApiTags("reports")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @ApiOperation({ summary: "Get live summary stats for dashboard" })
  @ApiQuery({ name: "range", required: false, enum: ["today", "yesterday", "week", "all"] })
  @Get("summary")
  getSummary(@Query("range") range?: string) {
    return this.reportsService.getSummary(range);
  }

  @ApiOperation({ summary: "Get live caller metrics, connects, and recording coverage" })
  @ApiQuery({ name: "range", required: false, enum: ["today", "yesterday", "week", "all"] })
  @Get("callers")
  getCallers(
    @Request() req: { user?: { id: string; role?: string } },
    @Query("range") range?: string,
  ) {
    if (req.user?.role === "telecaller") {
      throw new ForbiddenException("Access denied: Telecallers cannot view fleet performance audits");
    }
    return this.reportsService.getCallersReport(range);
  }
}
