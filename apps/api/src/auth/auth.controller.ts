import { Controller, Post, Body, UseGuards, Get, Request } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import type { LoginInput, RegisterInput, RefreshTokenInput } from "@telecalling-crm/shared";
import { JwtAuthGuard } from "./jwt-auth.guard";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: "Log in user and device" })
  @Post("login")
  login(@Body() body: LoginInput) {
    return this.authService.login(body);
  }

  @ApiOperation({ summary: "Register new user" })
  @Post("register")
  register(@Body() body: RegisterInput) {
    return this.authService.register(body);
  }

  @ApiOperation({ summary: "Rotate and refresh JWT access token" })
  @Post("refresh")
  refresh(@Body() body: RefreshTokenInput) {
    return this.authService.refreshTokens(body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Log out user/device session" })
  @Post("logout")
  logout(@Request() req: any, @Body("deviceId") deviceId?: string) {
    return this.authService.logout(req.user.id, deviceId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get current user profile" })
  @Get("me")
  getProfile(@Request() req: any) {
    return {
      success: true,
      data: req.user,
    };
  }
}
