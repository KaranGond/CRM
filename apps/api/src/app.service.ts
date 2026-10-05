import { Injectable } from "@nestjs/common";
import type { DashboardStats } from "@telecalling-crm/types";

@Injectable()
export class AppService {
  getHealth(): { status: string; timestamp: string } {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  }

  getDashboardStats(): DashboardStats {
    // TODO: Replace with real DB queries
    return {
      totalLeads: 1250,
      totalCalls: 8430,
      totalAgents: 24,
      activeCampaigns: 5,
      callsToday: 127,
      conversionRate: 12.5,
      avgCallDuration: 185, // seconds
    };
  }
}
