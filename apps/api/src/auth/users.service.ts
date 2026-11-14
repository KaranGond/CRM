import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import * as bcrypt from "bcrypt";
import type { Prisma, Role } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateUserInput, UpdateUserInput } from "@telecalling-crm/shared";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(filters: { role?: string; search?: string; active?: string }) {
    const where: Prisma.UserWhereInput = {};

    if (filters.role && filters.role !== "all") {
      where.role = filters.role as Role;
    }

    if (filters.active !== undefined && filters.active !== "all") {
      where.active = filters.active === "true";
    }

    if (filters.search && filters.search.trim()) {
      const q = filters.search.trim();
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
      ];
    }

    const users = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        active: true,
        createdAt: true,
        updatedAt: true,
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
        _count: {
          select: {
            leads: true,
            calls: true,
            followUps: true,
          },
        },
      },
    });

    return {
      success: true,
      data: users,
    };
  }

  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        active: true,
        createdAt: true,
        updatedAt: true,
        devices: {
          orderBy: { lastSeenAt: "desc" },
          take: 5,
          select: {
            id: true,
            model: true,
            androidVersion: true,
            appVersion: true,
            engineVersion: true,
            lastSeenAt: true,
            diagnostics: true,
          },
        },
        _count: {
          select: {
            leads: true,
            calls: true,
            followUps: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return { success: true, data: user };
  }

  async createUser(actorId: string, input: CreateUserInput) {
    const cleanEmail = input.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (existing) {
      throw new BadRequestException(`Email "${cleanEmail}" is already registered`);
    }

    const cleanPhone = input.phone.trim();
    if (cleanPhone.length < 10) {
      throw new BadRequestException("Phone number must have at least 10 digits");
    }

    if (!input.password || input.password.length < 8) {
      throw new BadRequestException("Password must be at least 8 characters");
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: cleanEmail,
        name: input.name.trim(),
        phone: cleanPhone,
        role: (input.role as Role) || "telecaller",
        active: input.active ?? true,
        passwordHash,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Auto-provision initial device entry for web sessions
    const deviceId = `web-session-${user.id.slice(0, 8)}`;
    await this.prisma.device
      .create({
        data: {
          id: deviceId,
          userId: user.id,
          model: "Web Portal",
          androidVersion: "N/A",
          appVersion: "1.0.0",
          engineVersion: "1.0.0",
        },
      })
      .catch(() => {
        // Ignore if device already exists
      });

    // Record audit log
    await this.prisma.auditLog
      .create({
        data: {
          actorId,
          action: "USER_CREATED",
          entity: "User",
          entityId: user.id,
          meta: {
            email: user.email,
            role: user.role,
            name: user.name,
          },
        },
      })
      .catch(() => {
        // Don't fail user creation if audit log fails
      });

    return {
      success: true,
      message: `User ${user.name} (${user.role}) created successfully`,
      data: user,
    };
  }

  async updateUser(
    id: string,
    actorId: string,
    input: UpdateUserInput & { password?: string },
  ) {
    const existing = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if (id === actorId && input.active === false) {
      throw new BadRequestException("You cannot deactivate your own account");
    }

    const updateData: Prisma.UserUpdateInput = {};

    if (input.name) updateData.name = input.name.trim();
    if (input.phone) updateData.phone = input.phone.trim();
    if (input.role) updateData.role = input.role as Role;
    if (input.active !== undefined) updateData.active = input.active;

    if (input.email) {
      const cleanEmail = input.email.trim().toLowerCase();
      if (cleanEmail !== existing.email) {
        const conflict = await this.prisma.user.findUnique({
          where: { email: cleanEmail },
        });
        if (conflict) {
          throw new BadRequestException(`Email "${cleanEmail}" is already in use`);
        }
        updateData.email = cleanEmail;
      }
    }

    if (input.password && input.password.trim()) {
      if (input.password.trim().length < 8) {
        throw new BadRequestException("Password must be at least 8 characters");
      }
      updateData.passwordHash = await bcrypt.hash(input.password.trim(), 10);
      // Revoke existing refresh tokens on password change
      await this.prisma.refreshToken
        .updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        })
        .catch(() => {});
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.prisma.auditLog
      .create({
        data: {
          actorId,
          action: "USER_UPDATED",
          entity: "User",
          entityId: id,
          meta: { changes: Object.keys(updateData) },
        },
      })
      .catch(() => {});

    return {
      success: true,
      message: `User ${updated.name} updated successfully`,
      data: updated,
    };
  }

  async toggleStatus(id: string, actorId: string, active: boolean) {
    if (id === actorId) {
      throw new BadRequestException("You cannot toggle your own active status");
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: { active },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
      },
    });

    if (!active) {
      // Immediately revoke all active refresh tokens for the deactivated user
      await this.prisma.refreshToken
        .updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        })
        .catch(() => {});
    }

    await this.prisma.auditLog
      .create({
        data: {
          actorId,
          action: active ? "USER_ACTIVATED" : "USER_DEACTIVATED",
          entity: "User",
          entityId: id,
        },
      })
      .catch(() => {});

    return {
      success: true,
      message: `User ${user.name} is now ${active ? "Active" : "Deactivated"}`,
      data: user,
    };
  }

  async resetPassword(id: string, actorId: string, newPassword: string) {
    if (!newPassword || newPassword.trim().length < 8) {
      throw new BadRequestException("Password must be at least 8 characters");
    }

    const existing = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const passwordHash = await bcrypt.hash(newPassword.trim(), 10);

    await this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    // Revoke all existing sessions
    await this.prisma.refreshToken
      .updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      .catch(() => {});

    await this.prisma.auditLog
      .create({
        data: {
          actorId,
          action: "USER_PASSWORD_RESET_BY_ADMIN",
          entity: "User",
          entityId: id,
        },
      })
      .catch(() => {});

    return {
      success: true,
      message: `Password for ${existing.name} has been reset successfully`,
    };
  }

  async deleteUser(id: string, actorId: string) {
    if (id === actorId) {
      throw new BadRequestException("You cannot delete your own account");
    }

    const existing = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Soft-deactivate to preserve audit trail, calls, and leads
    const deactivated = await this.prisma.user.update({
      where: { id },
      data: { active: false },
      select: {
        id: true,
        name: true,
        email: true,
        active: true,
      },
    });

    // Revoke all refresh tokens
    await this.prisma.refreshToken
      .updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      .catch(() => {});

    await this.prisma.auditLog
      .create({
        data: {
          actorId,
          action: "USER_DEACTIVATED_PERMANENT",
          entity: "User",
          entityId: id,
        },
      })
      .catch(() => {});

    return {
      success: true,
      message: `User ${deactivated.name} account has been deactivated`,
      data: deactivated,
    };
  }
}
