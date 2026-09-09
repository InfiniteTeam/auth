/**
 * Admin OIDC client management controller — `/api/v1/admin/clients`.
 *
 * Every handler is protected by the session-aware {@link PermissionsGuard} and
 * declares the permission it requires via `@Permissions(...)`.
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { PermissionFlags } from "@inftkr/shared";
import { Permissions, PermissionsGuard } from "../../session/permissions.guard.js";
import { AdminClientsService } from "./admin-clients.service.js";
import {
  CreateOidcClientDto,
  CreateOidcClientResponseDto,
  OidcClientDto,
  OidcClientListDto,
} from "./dto/client-admin.dto.js";

@ApiTags("admin")
@Controller("api/v1/admin/clients")
@UseGuards(PermissionsGuard)
export class AdminClientsController {
  constructor(private readonly adminClientsService: AdminClientsService) {}

  /**
   * Issues a new OIDC client. The generated `client_secret` is returned once.
   */
  @Post()
  @Permissions(PermissionFlags.OidcClientCreate)
  @ApiOperation({ summary: "Issue a new OIDC client" })
  @ApiResponse({
    status: 201,
    type: CreateOidcClientResponseDto,
    description: "The client was issued (secret is returned once)",
  })
  @ApiResponse({ status: 401, description: "Not authenticated" })
  @ApiResponse({ status: 403, description: "Missing oidc:client:create" })
  async create(@Body() body: CreateOidcClientDto) {
    return this.adminClientsService.create(body);
  }

  /**
   * Lists all registered OIDC clients.
   */
  @Get()
  @Permissions(PermissionFlags.OidcClientRead)
  @ApiOperation({ summary: "List OIDC clients" })
  @ApiResponse({ status: 200, type: OidcClientListDto })
  @ApiResponse({ status: 401, description: "Not authenticated" })
  @ApiResponse({ status: 403, description: "Missing oidc:client:read" })
  async list(): Promise<OidcClientListDto> {
    const clients = await this.adminClientsService.list();
    return { clients };
  }

  /**
   * Deletes a registered OIDC client.
   */
  @Delete(":clientId")
  @Permissions(PermissionFlags.OidcClientDelete)
  @HttpCode(204)
  @ApiOperation({ summary: "Delete an OIDC client" })
  @ApiResponse({ status: 204, description: "The client was deleted" })
  @ApiResponse({ status: 400, description: "Built-in client cannot be deleted" })
  @ApiResponse({ status: 401, description: "Not authenticated" })
  @ApiResponse({ status: 403, description: "Missing oidc:client:delete" })
  @ApiResponse({ status: 404, description: "Unknown client" })
  async remove(@Param("clientId") clientId: string) {
    await this.adminClientsService.remove(clientId);
  }
}