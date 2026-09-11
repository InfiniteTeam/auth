/**
 * Admin directory group controller — `/api/v1/admin/groups` (lldap-backed).
 */

import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { PermissionFlags } from "@inftkr/shared";
import { Permissions, PermissionsGuard } from "../../session/permissions.guard.js";
import { AdminGroupsService } from "./admin-groups.service.js";
import { AdminGroupDto, AdminGroupListDto, CreateAdminGroupDto, GroupMemberDto, UpdateAdminGroupDto } from "./dto/group-admin.dto.js";

@ApiTags("admin")
@Controller("api/v1/admin/groups")
@UseGuards(PermissionsGuard)
export class AdminGroupsController {
  constructor(private readonly adminGroupsService: AdminGroupsService) {}

  /** Lists all directory groups. */
  @Get()
  @Permissions(PermissionFlags.GroupRead)
  @ApiOperation({ summary: "List directory groups" })
  @ApiResponse({ status: 200, type: AdminGroupListDto })
  async list(): Promise<AdminGroupListDto> {
    const groups = await this.adminGroupsService.list();
    return { groups };
  }

  /** Creates a directory group. */
  @Post()
  @Permissions(PermissionFlags.GroupWrite)
  @ApiOperation({ summary: "Create a directory group" })
  @ApiResponse({ status: 201, type: AdminGroupDto })
  async create(@Body() body: CreateAdminGroupDto): Promise<AdminGroupDto> {
    return this.adminGroupsService.create(body.displayName);
  }

  /** Renames a directory group. */
  @Patch(":id")
  @Permissions(PermissionFlags.GroupWrite)
  @ApiOperation({ summary: "Rename a directory group" })
  @ApiResponse({ status: 200, type: AdminGroupDto })
  async update(@Param("id", ParseIntPipe) id: number, @Body() body: UpdateAdminGroupDto): Promise<AdminGroupDto> {
    return this.adminGroupsService.update(id, body.displayName);
  }

  /** Deletes a directory group. */
  @Delete(":id")
  @Permissions(PermissionFlags.GroupWrite)
  @HttpCode(204)
  @ApiOperation({ summary: "Delete a directory group" })
  @ApiResponse({ status: 204, description: "The group was deleted" })
  async remove(@Param("id", ParseIntPipe) id: number): Promise<void> {
    await this.adminGroupsService.remove(id);
  }

  /** Adds a user to a group. */
  @Post(":id/members")
  @Permissions(PermissionFlags.GroupWrite)
  @HttpCode(204)
  @ApiOperation({ summary: "Add a user to a group" })
  async addMember(@Param("id", ParseIntPipe) id: number, @Body() body: GroupMemberDto): Promise<void> {
    await this.adminGroupsService.addMember(id, body.userId);
  }

  /** Removes a user from a group. */
  @Delete(":id/members/:userId")
  @Permissions(PermissionFlags.GroupWrite)
  @HttpCode(204)
  @ApiOperation({ summary: "Remove a user from a group" })
  async removeMember(@Param("id", ParseIntPipe) id: number, @Param("userId") userId: string): Promise<void> {
    await this.adminGroupsService.removeMember(id, userId);
  }
}
