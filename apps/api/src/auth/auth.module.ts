import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { UsersController } from "./users.controller";
import { JwtStrategy } from "./jwt.strategy";

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || "fallback-secret",
      signOptions: { expiresIn: "15m" }, // short lived access token
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController, UsersController],
  exports: [AuthService],
})
export class AuthModule {}
