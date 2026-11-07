import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { DevicesModule } from "./devices/devices.module";
import { AppConfigModule } from "./config/config.module";
import { LeadsModule } from "./leads/leads.module";
import { CallsModule } from "./calls/calls.module";
import { FollowupsModule } from "./followups/followups.module";
import { RecordingsModule } from "./recordings/recordings.module";
import { SyncModule } from "./sync/sync.module";
import { ReportsModule } from "./reports/reports.module";
import { MessagesModule } from "./messages/messages.module";
import { HealthModule } from "./health/health.module";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    DevicesModule,
    AppConfigModule,
    LeadsModule,
    CallsModule,
    FollowupsModule,
    RecordingsModule,
    SyncModule,
    ReportsModule,
    MessagesModule,
    HealthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
