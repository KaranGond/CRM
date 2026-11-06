import { Controller, Post, Body, Param, Get, UseGuards, Request } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { DevicesService } from "./devices.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { RegisterDeviceInput, HeartbeatDeviceInput } from "@telecalling-crm/shared";

@ApiTags("devices")
@Controller("devices")
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Register or update caller device" })
  @Post()
  register(@Request() req: { user: { id: string } }, @Body() body: RegisterDeviceInput) {
    return this.devicesService.registerDevice(req.user.id, body);
  }

  @ApiOperation({ summary: "Device heartbeat with telemetry and health diagnostics" })
  @Post(":id/heartbeat")
  heartbeat(@Param("id") id: string, @Body() body: HeartbeatDeviceInput) {
    return this.devicesService.heartbeat(id, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "List all registered devices and their health" })
  @Get()
  list() {
    return this.devicesService.listDevices();
  }
}
