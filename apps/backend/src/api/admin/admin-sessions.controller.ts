/**
 * Admin session controller — `/api/v1/admin/sessions` (Prisma-backed).
 */

import { Controller, Delete, Get, HttpCode, NotFoundException, Param, Query, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { PermissionFlags } from "@inftkr/shared";
import { Permissions, PermissionsGuard } from "../../session/permissions.guard.js";
import { AdminSessionsService } from "./admin-sessions.service.js";
import { AdminSessionListDto, ListAdminSessionsQueryDto } from "./dto/session-admin.dto.js";

@ApiTags("admin")
@Controller("api/v1/admin/sessions")
@UseGuards(PermissionsGuard)
export class AdminSessionsController {
  constructor(private readonly adminSessionsService: AdminSessionsService) {}

  /** Lists sessions, newest first. */
  @Get()
  @Permissions(PermissionFlags.SessionRead)
  @ApiOperation({ summary: "List sessions" })
  @ApiResponse({ status: 200, type: AdminSessionListDto })
  async list(@Query() query: ListAdminSessionsQueryDto): Promise<AdminSessionListDto> {
    const sessions = await this.adminSessionsService.list({
      userId: query.userId,
      activeOnly: query.activeOnly ?? true,
      limit: query.limit ?? 50,
    });
    return { sessions };
  }

  /** Revokes a session by id. */
  @Delete(":id")
  @Permissions(PermissionFlags.SessionRevoke)
  @HttpCode(204)
  @ApiOperation({ summary: "Revoke a session" })
  @ApiResponse({ status: 204, description: "The session was revoked" })
  async revoke(@Param("id") id: string): Promise<void> {
    const revoked = await this.adminSessionsService.revoke(id);
    if (!revoked) {
      throw new NotFoundException(`Unknown session "${id}"`);
    }
  }
}
