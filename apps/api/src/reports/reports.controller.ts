import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { ReportsService } from "./reports.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@ApiTags("reports")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @ApiOperation({ summary: "Get live summary stats for dashboard" })
  @Get("summary")
  getSummary() {
    return this.reportsService.getSummary();
  }

  @ApiOperation({ summary: "Get live caller metrics, connects, and recording coverage" })
  @Get("callers")
  getCallers() {
    return this.reportsService.getCallersReport();
  }

  @ApiOperation({ summary: "Get head-to-head pilot benchmark comparison vs RMDialer" })
  @Get("benchmark")
  getBenchmark() {
    return this.reportsService.getBenchmarkReport();
  }
}
