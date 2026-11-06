import { Module } from "@nestjs/common";
import { FollowupsController } from "./followups.controller";
import { FollowupsService } from "./followups.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [FollowupsController],
  providers: [FollowupsService],
  exports: [FollowupsService],
})
export class FollowupsModule {}
