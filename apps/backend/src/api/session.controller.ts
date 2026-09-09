/**
 * Session controller — `GET/DELETE /api/v1/session`.
 *
 * Follows the shared `@inftkr/auth-core` contract: `GET` returns the current
 * session or `401` when unauthenticated, `DELETE` signs out (revokes) and
 * returns `204`.
 */

import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { SESSION_COOKIE_NAME } from "@inftkr/shared";
import type { Session } from "@inftkr/shared";
import { SessionService } from "../session/session.service.js";

@ApiTags("session")
@Controller("api/v1/session")
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  /**
   * Returns the current authenticated session.
   */
  @Get()
  @ApiOperation({ summary: "Get the current session" })
  @ApiResponse({ status: 200, description: "The current session" })
  @ApiResponse({ status: 401, description: "No valid session cookie" })
  async getSession(@Req() req: Request): Promise<Session> {
    const raw = (req.cookies as Record<string, string | undefined>)[
      SESSION_COOKIE_NAME
    ];
    const session = await this.sessionService.resolveSessionFromCookie(raw);
    if (!session) {
      throw new UnauthorizedException();
    }
    return session;
  }

  /**
   * Destroys the current session and clears the cookie.
   */
  @Delete()
  @HttpCode(204)
  @ApiOperation({ summary: "Sign out" })
  @ApiResponse({
    status: 204,
    description: "Session revoked and cookie cleared",
  })
  async deleteSession(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const raw = (req.cookies as Record<string, string | undefined>)[
      SESSION_COOKIE_NAME
    ];
    await this.sessionService.revokeSession(raw);
    res.clearCookie(SESSION_COOKIE_NAME, this.sessionService.cookieOptions);
  }
}
