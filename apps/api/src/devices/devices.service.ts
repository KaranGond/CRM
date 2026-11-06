import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { RegisterDeviceInput, HeartbeatDeviceInput } from "@telecalling-crm/shared";

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  async registerDevice(userId: string, data: RegisterDeviceInput) {
    const device = await this.prisma.device.upsert({
      where: { id: data.id },
      update: {
        userId,
        model: data.model,
        androidVersion: data.androidVersion,
        appVersion: data.appVersion,
        engineVersion: data.engineVersion,
        fcmToken: data.fcmToken,
        diagnostics: data.diagnostics ? JSON.parse(JSON.stringify(data.diagnostics)) : undefined,
        lastSeenAt: new Date(),
      },
      create: {
        id: data.id,
        userId,
        model: data.model,
        androidVersion: data.androidVersion,
        appVersion: data.appVersion,
        engineVersion: data.engineVersion,
        fcmToken: data.fcmToken,
        diagnostics: data.diagnostics ? JSON.parse(JSON.stringify(data.diagnostics)) : undefined,
        lastSeenAt: new Date(),
      },
    });

    return { success: true, data: device };
  }

  async heartbeat(deviceId: string, data: HeartbeatDeviceInput) {
    const existing = await this.prisma.device.findUnique({
      where: { id: deviceId },
    });

    if (!existing) {
      throw new NotFoundException(`Device ${deviceId} not found`);
    }

    const updated = await this.prisma.device.update({
      where: { id: deviceId },
      data: {
        lastSeenAt: new Date(),
        fcmToken: data.fcmToken ?? existing.fcmToken,
        appVersion: data.appVersion ?? existing.appVersion,
        engineVersion: data.engineVersion ?? existing.engineVersion,
        diagnostics: data.diagnostics
          ? JSON.parse(JSON.stringify(data.diagnostics))
          : (existing.diagnostics ?? undefined),
      },
    });

    return {
      success: true,
      data: {
        serverTime: new Date().toISOString(),
        acknowledged: true,
        deviceId: updated.id,
      },
    };
  }

  async listDevices() {
    const devices = await this.prisma.device.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { lastSeenAt: "desc" },
    });

    return { success: true, data: devices };
  }
}
