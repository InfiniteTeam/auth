/**
 * Self-service account controller — `/api/v1/account`.
 *
 * All handlers require an authenticated session (`SessionGuard`); no admin
 * permissions are needed because users only ever touch their own account.
 */

import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import type { Session } from "@inftkr/shared";
import { SessionGuard } from "../session/session.guard.js";
import { AccountService } from "./account.service.js";
import { ChangePasswordDto, ConfirmEmailChangeDto, RequestEmailChangeDto } from "./dto/account.dto.js";

function currentSession(req: Request): Session {
  const session = (req as Request & { session?: Session }).session;
  if (!session) {
    throw new Error("SessionGuard must run before handlers");
  }
  return session;
}

@ApiTags("account")
@Controller("api/v1/account")
@UseGuards(SessionGuard)
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  /** Lists the current user's linked social identities. */
  @Get("social")
  @ApiOperation({ summary: "List my linked social identities" })
  async linkedSocial(@Req() req: Request) {
    const socials = await this.accountService.linkedSocialAccounts(currentSession(req).user.userId);
    return { socials };
  }

  /** Unlinks a social identity from the current user. */
  @Delete("social/:provider")
  @HttpCode(204)
  @ApiOperation({ summary: "Unlink a social identity" })
  @ApiResponse({ status: 204, description: "The social identity was unlinked" })
  async unlinkSocial(@Req() req: Request, @Param("provider") provider: string): Promise<void> {
    await this.accountService.unlinkSocial(currentSession(req), provider);
  }

  /** Changes (or initially sets) the current user's LDAP password. */
  @Post("password")
  @HttpCode(204)
  @ApiOperation({ summary: "Change my password" })
  @ApiResponse({ status: 204, description: "The password was changed" })
  async changePassword(@Req() req: Request, @Body() body: ChangePasswordDto): Promise<void> {
    await this.accountService.changePassword(currentSession(req), body.currentPassword, body.newPassword);
  }

  /** Requests an email change (sends a code to the new address). */
  @Post("email/request")
  @ApiOperation({ summary: "Request an email change" })
  async requestEmailChange(@Req() req: Request, @Body() body: RequestEmailChangeDto) {
    return this.accountService.requestEmailChange(currentSession(req), body.newEmail);
  }

  /** Confirms an email change and migrates the identity. */
  @Post("email/confirm")
  @ApiOperation({ summary: "Confirm an email change" })
  async confirmEmailChange(@Req() req: Request, @Body() body: ConfirmEmailChangeDto) {
    return this.accountService.confirmEmailChange(currentSession(req), body.code);
  }
}
