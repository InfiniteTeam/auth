/**
 * Auth controller — `POST /api/v1/auth/ldap` (and the social sign-in entry
 * point, wired in a follow-up).
 *
 * On successful LDAP authentication a signed `inft_session` cookie is set and
 * the new session is returned.
 *
 * LDAP sign-in is limited to the `ALLOWED_DOMAINS` allow-list. Social sign-up
 * is not domain-gated, so an account may exist with an outside email and
 * simply have no LDAP access until its email is changed.
 */

import {
  Body,
  Controller,
  Inject,
  Post,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import type { Session } from "@inftkr/shared";
import { SESSION_COOKIE_NAME } from "@inftkr/shared";
import { LdapLoginDto } from "./dto/auth.dto.js";
import { APP_CONFIG, type AppConfig } from "../config/config.js";
import { PlatformSettingsService } from "../config/platform-settings.service.js";
import { isEmailDomainAllowed } from "../common/email-domain.util.js";
import {
  LldapAuthenticationError,
  LldapService,
} from "../lldap/lldap.service.js";
import { SessionService } from "../session/session.service.js";

@ApiTags("auth")
@Controller("api/v1/auth")
export class AuthController {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly platformSettings: PlatformSettingsService,
    private readonly lldapService: LldapService,
    private readonly sessionService: SessionService,
  ) {}

  /**
   * Authenticates with LDAP credentials and starts a new session.
   */
  @Post("ldap")
  @ApiOperation({ summary: "Sign in with LDAP credentials" })
  @ApiResponse({ status: 201, description: "A new session was created" })
  @ApiResponse({
    status: 401,
    description: "Invalid credentials, or an email domain that cannot use LDAP",
  })
  async loginLdap(
    @Body() body: LdapLoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Session> {
    // Rejected identically to bad credentials so the endpoint cannot be used
    // to probe which email domains or addresses exist.
    const allowedDomains = await this.platformSettings.getAllowedDomains();
    if (!isEmailDomainAllowed(body.email, allowedDomains)) {
      throw new UnauthorizedException();
    }
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
        permissions: user.permissions,
      });
      res.cookie(
        SESSION_COOKIE_NAME,
        cookieValue,
        this.sessionService.cookieOptions,
      );
      return session;
    } catch (error) {
      if (error instanceof LldapAuthenticationError) {
        throw new UnauthorizedException();
      }
      throw error;
    }
  }
}
