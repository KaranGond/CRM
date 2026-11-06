import { Controller, Get, Post, Body, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { ConfigService } from "./config.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { CreatePipelineStageInput, CreateDispositionTypeInput } from "@telecalling-crm/shared";

@ApiTags("config")
@Controller("config")
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @ApiOperation({ summary: "Get global system configuration" })
  @Get()
  getConfig() {
    return this.configService.getAppConfig();
  }

  @ApiOperation({ summary: "List active pipeline stages" })
  @Get("stages")
  listStages() {
    return this.configService.listStages();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Create pipeline stage (Admin/Manager)" })
  @Post("stages")
  createStage(@Body() body: CreatePipelineStageInput) {
    return this.configService.createStage(body);
  }

  @ApiOperation({ summary: "List active disposition types" })
  @Get("dispositions")
  listDispositions() {
    return this.configService.listDispositions();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Create disposition type (Admin/Manager)" })
  @Post("dispositions")
  createDisposition(@Body() body: CreateDispositionTypeInput) {
    return this.configService.createDisposition(body);
  }
}
