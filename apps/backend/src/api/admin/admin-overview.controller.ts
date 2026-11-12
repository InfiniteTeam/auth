import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { PermissionFlags } from "@inftkr/shared";
import {
  Permissions,
  PermissionsGuard,
} from "../../session/permissions.guard.js";
import { AdminOverviewService } from "./admin-overview.service.js";

@ApiTags("admin")
@Controller("api/v1/admin/overview")
@UseGuards(PermissionsGuard)
export class AdminOverviewController {
  constructor(private readonly overview: AdminOverviewService) {}

  @Get()
  @Permissions(
    PermissionFlags.SessionRead,
    PermissionFlags.OidcClientRead,
    PermissionFlags.SettingsRead,
  )
  @ApiOperation({
    summary: "Get weekly sign-ins and recent client and setting changes",
  })
  get() {
    return this.overview.get();
  }
}
