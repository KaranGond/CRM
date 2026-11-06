import { Module } from "@nestjs/common";
import { SyncController } from "./sync.controller";
import { SyncService } from "./sync.service";
import { PrismaModule } from "../prisma/prisma.module";
import { CallsModule } from "../calls/calls.module";
import { FollowupsModule } from "../followups/followups.module";
import { LeadsModule } from "../leads/leads.module";

import { MessagesModule } from "../messages/messages.module";

@Module({
  imports: [PrismaModule, CallsModule, FollowupsModule, LeadsModule, MessagesModule],
  controllers: [SyncController],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}
