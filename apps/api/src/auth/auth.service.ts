import { Injectable, UnauthorizedException, BadRequestException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import * as crypto from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import type {
  LoginInput,
  RegisterInput,
  RefreshTokenInput,
  AuthTokens,
} from "@telecalling-crm/shared";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(data: LoginInput) {
    const cleanEmail = data.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!user || !user.active) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const passwordMatches = await bcrypt.compare(data.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const deviceId = data.deviceId ?? "web-session";

    // Ensure device is registered/updated if deviceInfo is provided
    let deviceRecord = null;
    if (data.deviceInfo) {
      deviceRecord = await this.prisma.device.upsert({
        where: { id: data.deviceInfo.id },
        update: {
          userId: user.id,
          model: data.deviceInfo.model,
          androidVersion: data.deviceInfo.androidVersion,
          appVersion: data.deviceInfo.appVersion,
          engineVersion: data.deviceInfo.engineVersion,
          fcmToken: data.deviceInfo.fcmToken,
          lastSeenAt: new Date(),
          diagnostics: data.deviceInfo.diagnostics ?? undefined,
        },
        create: {
          id: data.deviceInfo.id,
          userId: user.id,
          model: data.deviceInfo.model,
          androidVersion: data.deviceInfo.androidVersion,
          appVersion: data.deviceInfo.appVersion,
          engineVersion: data.deviceInfo.engineVersion,
          fcmToken: data.deviceInfo.fcmToken,
          diagnostics: data.deviceInfo.diagnostics ?? undefined,
        },
      });
    } else {
      // Ensure dummy device exists for web/testing
      deviceRecord = await this.prisma.device.upsert({
        where: { id: deviceId },
        update: { userId: user.id, lastSeenAt: new Date() },
        create: {
          id: deviceId,
          userId: user.id,
          model: "Web / Unknown",
          androidVersion: "N/A",
          appVersion: "1.0.0",
          engineVersion: "1.0.0",
        },
      });
    }

    const tokens = await this.generateAndStoreTokens(user.id, deviceId);
    const { passwordHash: _passwordHash, ...safeUser } = user;

    return {
      success: true,
      data: {
        ...tokens,
        user: safeUser,
        device: deviceRecord,
      },
    };
  }

  async register(data: RegisterInput) {
    const cleanEmail = data.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email: cleanEmail },
    });
    if (existing) {
      throw new BadRequestException("Email already in use");
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: cleanEmail,
        name: data.name,
        passwordHash,
        phone: data.phone,
        role: data.role ?? "telecaller",
        active: data.active ?? true,
      },
    });

    const deviceId = "web-initial";
    await this.prisma.device.upsert({
      where: { id: deviceId },
      update: { userId: user.id, lastSeenAt: new Date() },
      create: {
        id: deviceId,
        userId: user.id,
        model: "Web / Initial",
        androidVersion: "N/A",
        appVersion: "1.0.0",
        engineVersion: "1.0.0",
      },
    });

    const tokens = await this.generateAndStoreTokens(user.id, deviceId);
    const { passwordHash: _passwordHash, ...safeUser } = user;

    return {
      success: true,
      data: {
        ...tokens,
        user: safeUser,
      },
    };
  }

  async refreshTokens(data: RefreshTokenInput) {
    try {
      const payload = this.jwtService.verify(data.refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || "fallback-refresh-secret",
      });

      const tokenHash = this.hashToken(data.refreshToken);
      const storedToken = await this.prisma.refreshToken.findUnique({
        where: { tokenHash },
      });

      if (!storedToken || storedToken.expiresAt < new Date()) {
        throw new UnauthorizedException("Invalid or expired refresh token");
      }

      if (storedToken.revokedAt) {
        // SECURITY VIOLATION: Replay attack detected on an already rotated refresh token!
        // Immediately revoke ALL active sessions for this (userId, deviceId) to protect the account.
        await this.prisma.refreshToken.updateMany({
          where: { userId: storedToken.userId, deviceId: storedToken.deviceId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        throw new UnauthorizedException("Session revoked: Refresh token reuse detected.");
      }

      if (storedToken.deviceId !== data.deviceId) {
        throw new UnauthorizedException("Device mismatch for refresh token");
      }

      // Rotate: Revoke the old token
      await this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
      });

      // Generate and store new pair
      const tokens = await this.generateAndStoreTokens(payload.sub, data.deviceId);
      return {
        success: true,
        data: tokens,
      };
    } catch (err) {
      throw new UnauthorizedException(err instanceof Error ? err.message : "Invalid refresh token");
    }
  }

  async logout(userId: string, deviceId?: string) {
    if (deviceId) {
      await this.prisma.refreshToken.updateMany({
        where: { userId, deviceId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } else {
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return { success: true, data: { success: true } };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) {
      throw new BadRequestException("Current password does not match");
    }

    if (!newPassword || newPassword.trim().length < 8) {
      throw new BadRequestException("New password must be at least 8 characters");
    }

    const passwordHash = await bcrypt.hash(newPassword.trim(), 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Revoke old sessions
    await this.prisma.refreshToken
      .updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      .catch(() => {});

    await this.prisma.auditLog
      .create({
        data: {
          actorId: userId,
          action: "USER_PASSWORD_CHANGED",
          entity: "User",
          entityId: userId,
        },
      })
      .catch(() => {});

    return {
      success: true,
      message: "Password updated successfully. Please log in with your new password on other devices.",
    };
  }

  private async generateAndStoreTokens(userId: string, deviceId: string): Promise<AuthTokens> {
    const accessTtlSec = parseInt(process.env.ACCESS_TOKEN_TTL_SEC || "900", 10);
    const refreshTtlSec = parseInt(process.env.REFRESH_TOKEN_TTL_SEC || "2592000", 10);

    const accessToken = this.jwtService.sign(
      { sub: userId, deviceId },
      { expiresIn: accessTtlSec },
    );

    const refreshTokenRaw = this.jwtService.sign(
      { sub: userId, deviceId, nonce: crypto.randomBytes(16).toString("hex") },
      {
        secret: process.env.JWT_REFRESH_SECRET || "fallback-refresh-secret",
        expiresIn: refreshTtlSec,
      },
    );

    const tokenHash = this.hashToken(refreshTokenRaw);
    const expiresAt = new Date(Date.now() + refreshTtlSec * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        deviceId,
        tokenHash,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: refreshTokenRaw,
      expiresIn: accessTtlSec,
    };
  }

  private hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }
}
