/**
 * Admin directory user controller — `/api/v1/admin/users` (lldap-backed).
 */

import { Body, Controller, Delete, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { PermissionFlags } from "@inftkr/shared";
import { Permissions, PermissionsGuard } from "../../session/permissions.guard.js";
import { AdminUsersService } from "./admin-users.service.js";
import { AdminUserDto, AdminUserListDto, ListAdminUsersQueryDto, UpdateAdminUserDto } from "./dto/user-admin.dto.js";

@ApiTags("admin")
@Controller("api/v1/admin/users")
@UseGuards(PermissionsGuard)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  /** Lists directory users. */
  @Get()
  @Permissions(PermissionFlags.UserRead)
  @ApiOperation({ summary: "List directory users" })
  @ApiResponse({ status: 200, type: AdminUserListDto })
  async list(@Query() query: ListAdminUsersQueryDto): Promise<AdminUserListDto> {
    const users = await this.adminUsersService.list(query.search, query.limit ?? 50);
    return { users };
  }

  /** Returns a single directory user. */
  @Get(":id")
  @Permissions(PermissionFlags.UserRead)
  @ApiOperation({ summary: "Get a directory user" })
  @ApiResponse({ status: 200, type: AdminUserDto })
  async get(@Param("id") id: string): Promise<AdminUserDto> {
    return this.adminUsersService.get(id);
  }

  /** Updates a directory user. */
  @Patch(":id")
  @Permissions(PermissionFlags.UserWrite)
  @ApiOperation({ summary: "Update a directory user" })
  @ApiResponse({ status: 200, type: AdminUserDto })
  async update(@Param("id") id: string, @Body() body: UpdateAdminUserDto): Promise<AdminUserDto> {
    return this.adminUsersService.update(id, body);
  }

  /** Deletes a directory user. */
  @Delete(":id")
  @Permissions(PermissionFlags.UserWrite)
  @ApiOperation({ summary: "Delete a directory user" })
  @ApiResponse({ status: 204, description: "The user was deleted" })
  async remove(@Param("id") id: string): Promise<void> {
    await this.adminUsersService.remove(id);
  }
}
