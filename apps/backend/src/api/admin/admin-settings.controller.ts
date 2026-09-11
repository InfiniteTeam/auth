/**
 * Admin settings controller — `/api/v1/admin/settings` and `/api/v1/admin/meta`.
 */

import { Body, Controller, Get, Param, Put, Req, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import type { Session } from "@inftkr/shared";
import { PermissionFlags } from "@inftkr/shared";
import { Permissions, PermissionsGuard } from "../../session/permissions.guard.js";
import { AdminSettingsService } from "./admin-settings.service.js";

@ApiTags("admin")
@Controller("api/v1/admin")
@UseGuards(PermissionsGuard)
export class AdminSettingsController {
  constructor(private readonly adminSettingsService: AdminSettingsService) {}

  /** Lists every registered setting with its effective value. */
  @Get("settings")
  @Permissions(PermissionFlags.SettingsRead)
  @ApiOperation({ summary: "List platform settings" })
  async list() {
    const settings = await this.adminSettingsService.list();
    return { settings };
  }

  /** Sets or clears a setting override. */
  @Put("settings/:key")
  @Permissions(PermissionFlags.SettingsWrite)
  @ApiOperation({ summary: "Set or clear a platform setting" })
  async set(@Param("key") key: string, @Body() body: { value: unknown }, @Req() req: Request & { session?: Session }) {
    const setting = await this.adminSettingsService.set(key, body?.value, req.session?.user.userId);
    return { setting };
  }

  /** Returns deployment metadata (issuer, callbacks, domains). */
  @Get("meta")
  @Permissions(PermissionFlags.SettingsRead)
  @ApiOperation({ summary: "Get deployment metadata" })
  async meta() {
    return this.adminSettingsService.meta();
  }
}
