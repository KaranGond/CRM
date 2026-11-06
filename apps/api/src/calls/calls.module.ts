import { Module } from "@nestjs/common";
import { CallsController } from "./calls.controller";
import { CallsService } from "./calls.service";
import { PrismaModule } from "../prisma/prisma.module";
import { MessagesModule } from "../messages/messages.module";

@Module({
  imports: [PrismaModule, MessagesModule],
  controllers: [CallsController],
  providers: [CallsService],
  exports: [CallsService],
})
export class CallsModule {}
