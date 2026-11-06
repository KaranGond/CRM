import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { PrismaService } from "../prisma/prisma.service";
import { JwtAuthGuard } from "./jwt-auth.guard";

@ApiTags("users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @ApiOperation({ summary: "List users and telecallers" })
  @Get()
  async list(@Query("role") role?: string) {
    const where: any = {};
    if (role) where.role = role;
    const users = await this.prisma.user.findMany({
      where,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        active: true,
        createdAt: true,
        devices: {
          orderBy: { lastSeenAt: "desc" },
          take: 1,
          select: {
            id: true,
            model: true,
            androidVersion: true,
            appVersion: true,
            lastSeenAt: true,
            diagnostics: true,
          },
        },
      },
    });
    return { success: true, data: users };
  }
}
