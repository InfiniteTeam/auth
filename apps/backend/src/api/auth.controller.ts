/**
 * Auth controller — `POST /api/v1/auth/ldap` (and the social sign-in entry
 * point, wired in a follow-up).
 *
 * On successful LDAP authentication a signed `inft_session` cookie is set and
 * the new session is returned.
 */

import {
  Body,
  Controller,
  Post,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import type { Session } from "@inft/shared";
import { SESSION_COOKIE_NAME } from "@inft/shared";
import { LdapLoginDto } from "./dto/auth.dto.js";
import {
  LldapAuthenticationError,
  LldapService,
} from "../lldap/lldap.service.js";
import { SessionService, SESSION_COOKIE } from "../session/session.service.js";

@ApiTags("auth")
@Controller("api/v1/auth")
export class AuthController {
  constructor(
    private readonly lldapService: LldapService,
    private readonly sessionService: SessionService,
  ) {}

  /**
   * Authenticates with LDAP credentials and starts a new session.
   */
  @Post("ldap")
  @ApiOperation({ summary: "Sign in with LDAP credentials" })
  @ApiResponse({ status: 201, description: "A new session was created" })
  @ApiResponse({ status: 401, description: "Invalid credentials" })
  async loginLdap(
    @Body() body: LdapLoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Session> {
    try {
      const user = await this.lldapService.authenticate(
        body.email,
        body.password,
      );
      const { session, cookieValue } = await this.sessionService.createSession({
        userId: user.id,
        provider: "ldap",
        email: user.email,
        name: user.name,
        roles: user.roles,
      });
      res.cookie(SESSION_COOKIE_NAME, cookieValue, SESSION_COOKIE);
      return session;
    } catch (error) {
      if (error instanceof LldapAuthenticationError) {
        throw new UnauthorizedException();
      }
      throw error;
    }
  }
}
