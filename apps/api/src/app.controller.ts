import { Controller, Get } from "@nestjs/common";
import { AppService } from "./app.service";
import type { ApiResponse, DashboardStats } from "@telecalling-crm/types";

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get("health")
  getHealth(): { status: string; timestamp: string } {
    return this.appService.getHealth();
  }

  @Get("dashboard/stats")
  getDashboardStats(): ApiResponse<DashboardStats> {
    return {
      data: this.appService.getDashboardStats(),
    };
  }
}
