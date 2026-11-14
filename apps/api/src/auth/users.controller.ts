import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from "@nestjs/swagger";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { RolesGuard } from "./roles.guard";
import { Roles } from "./roles.decorator";
import { UsersService } from "./users.service";
import type { CreateUserInput, UpdateUserInput, AdminResetPasswordInput } from "@telecalling-crm/shared";

@ApiTags("users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: "List users and team members (Admin & Manager only)" })
  @Roles("admin", "manager")
  @Get()
  list(
    @Query("role") role?: string,
    @Query("search") search?: string,
    @Query("active") active?: string,
  ) {
    return this.usersService.listUsers({ role, search, active });
  }

  @ApiOperation({ summary: "Get detailed user profile by ID" })
  @Roles("admin", "manager")
  @Get(":id")
  @ApiParam({ name: "id", type: "string" })
  getById(@Param("id") id: string) {
    return this.usersService.getUserById(id);
  }

  @ApiOperation({ summary: "Create new user account (Admin only)" })
  @Roles("admin")
  @Post()
  create(
    @Request() req: { user: { id: string } },
    @Body() body: CreateUserInput,
  ) {
    return this.usersService.createUser(req.user.id, body);
  }

  @ApiOperation({ summary: "Update user account profile or role (Admin only)" })
  @Roles("admin")
  @Patch(":id")
  @ApiParam({ name: "id", type: "string" })
  update(
    @Param("id") id: string,
    @Request() req: { user: { id: string } },
    @Body() body: UpdateUserInput & { password?: string },
  ) {
    return this.usersService.updateUser(id, req.user.id, body);
  }

  @ApiOperation({ summary: "Toggle user active/deactivated status (Admin only)" })
  @Roles("admin")
  @Patch(":id/status")
  @ApiParam({ name: "id", type: "string" })
  toggleStatus(
    @Param("id") id: string,
    @Request() req: { user: { id: string } },
    @Body("active") active: boolean,
  ) {
    return this.usersService.toggleStatus(id, req.user.id, active);
  }

  @ApiOperation({ summary: "Reset user password (Admin only)" })
  @Roles("admin")
  @Patch(":id/password")
  @ApiParam({ name: "id", type: "string" })
  resetPassword(
    @Param("id") id: string,
    @Request() req: { user: { id: string } },
    @Body() body: AdminResetPasswordInput,
  ) {
    return this.usersService.resetPassword(id, req.user.id, body.newPassword);
  }

  @ApiOperation({ summary: "Deactivate user account (Admin only)" })
  @Roles("admin")
  @Delete(":id")
  @ApiParam({ name: "id", type: "string" })
  delete(
    @Param("id") id: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.usersService.deleteUser(id, req.user.id);
  }
}
