/**
 * Social sign-in controller — `POST /api/v1/auth/social/:provider` (start),
 * `GET .../:provider/callback` (OAuth redirect), and the email-verification
 * endpoints for sign-up.
 *
 * The start endpoint responds with a `302` to the provider authorization URL
 * (setting the signed `inft_oauth_state` cookie), which is what
 * `@inftkr/auth-core`'s `loginSocial` expects.
 */

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import type { Session } from "@inftkr/shared";
import { SESSION_COOKIE_NAME } from "@inftkr/shared";
import { APP_CONFIG, type AppConfig } from "../config/config.js";
import { SocialLoginParams } from "../api/dto/auth.dto.js";
import { SessionService } from "../session/session.service.js";
import {
  OAUTH_STATE_COOKIE_NAME,
  OAuthStateService,
} from "./oauth-state.service.js";
import { SocialSettingsService } from "./social-settings.service.js";
import { SocialService } from "./social.service.js";
import type { SocialProviderId } from "./social.types.js";
import {
  SocialLinkQueryDto,
  SocialResendDto,
  SocialVerifyDto,
} from "./dto/social.dto.js";

/** Raw provider callback query; deliberately unvalidated so that provider error
 * parameters (e.g. `error_description`) never 400 the redirect. */
interface SocialCallbackQuery {
  code?: string | undefined;
  state?: string | undefined;
  error?: string | undefined;
}

@ApiTags("auth")
@Controller("api/v1/auth/social")
export class SocialController {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly social: SocialService,
    private readonly settings: SocialSettingsService,
    private readonly oauthState: OAuthStateService,
    private readonly sessionService: SessionService,
  ) {}

  /**
   * Starts a social sign-in flow by redirecting to the provider.
   */
  @Post(":provider")
  @ApiOperation({ summary: "Start a social sign-in flow" })
  @ApiResponse({ status: 302, description: "Redirect to the provider" })
  @ApiResponse({ status: 404, description: "Provider is not enabled" })
  async start(
    @Param() params: SocialLoginParams,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const provider = params.provider as SocialProviderId;
    if (!(await this.settings.isEnabled(provider))) {
      throw new NotFoundException(
        "Social sign-in is not available for this provider.",
      );
    }
    const session = await this.currentSession(req);
    const { authorizationUrl, cookieValue } = await this.social.start(
      provider,
      Boolean(session),
    );
    res.cookie(
      OAUTH_STATE_COOKIE_NAME,
      cookieValue,
      this.oauthState.cookieOptions,
    );
    res.redirect(302, authorizationUrl);
  }

  /**
   * Handles the provider's OAuth callback and redirects to the frontend with
   * the appropriate outcome.
   */
  @Get(":provider/callback")
  @ApiOperation({ summary: "Handle the provider OAuth callback" })
  @ApiResponse({ status: 302, description: "Redirect to the frontend" })
  async callback(
    @Param() params: SocialLoginParams,
    @Query() query: SocialCallbackQuery,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const provider = params.provider as SocialProviderId;
    const rawState = (req.cookies as Record<string, string | undefined>)[
      OAUTH_STATE_COOKIE_NAME
    ];
    res.clearCookie(
      OAUTH_STATE_COOKIE_NAME,
      this.oauthState.cookieOptions,
    );
    const session = await this.currentSession(req);
    const outcome = await this.social.callback(
      provider,
      query,
      rawState,
      session,
    );

    const base = this.config.socialRedirectBaseUrl.replace(/\/$/, "");
    switch (outcome.kind) {
      case "login":
        res.cookie(
          SESSION_COOKIE_NAME,
          outcome.cookieValue,
          this.sessionService.cookieOptions,
        );
        res.redirect(302, `${base}/?social=ok`);
        return;
      case "connect":
        res.redirect(302, `${base}/settings?social=connected`);
        return;
      case "verification":
        res.redirect(
          302,
          `${base}/verify-email?account=${encodeURIComponent(outcome.accountId)}&provider=${encodeURIComponent(provider)}`,
        );
        return;
      case "error":
        res.redirect(
          302,
          `${base}/social/error?provider=${encodeURIComponent(provider)}&error=${encodeURIComponent(outcome.code)}`,
        );
        return;
    }
  }

  /**
   * Confirms an email with the six-digit code and returns a new session.
   */
  @Post("verify")
  @HttpCode(200)
  @ApiOperation({ summary: "Verify the sign-up email with a code" })
  @ApiResponse({ status: 200, description: "A new session was created" })
  @ApiResponse({ status: 400, description: "Invalid or expired code" })
  async verify(
    @Body() body: SocialVerifyDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Session> {
    const outcome = await this.social.verify(body.accountId, body.code);
    if (!outcome.ok) {
      throw new BadRequestException("Invalid or expired verification code.");
    }
    res.cookie(
      SESSION_COOKIE_NAME,
      outcome.cookieValue,
      this.sessionService.cookieOptions,
    );
    return outcome.session;
  }

  /**
   * Requests a fresh verification email for a pending account.
   */
  @Post("verify/resend")
  @HttpCode(200)
  @ApiOperation({ summary: "Resend the verification email" })
  @ApiResponse({ status: 200, description: "Verification email sent" })
  @ApiResponse({ status: 400, description: "Resend is not possible" })
  async resend(@Body() body: SocialResendDto): Promise<{ ok: true }> {
    const result = await this.social.resendVerification(body.accountId);
    if (!result.ok) {
      throw new BadRequestException(
        "Unable to resend the verification email.",
      );
    }
    return { ok: true };
  }

  /**
   * Completes email verification via the one-time link and signs the user in.
   */
  @Get("verify/link")
  @ApiOperation({ summary: "Verify the sign-up email via the link token" })
  @ApiResponse({ status: 302, description: "Redirect to the frontend" })
  async verifyLink(
    @Query() query: SocialLinkQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const base = this.config.socialRedirectBaseUrl.replace(/\/$/, "");
    const outcome = await this.social.verifyLink(query.accountId, query.token);
    if (!outcome.ok) {
      res.redirect(
        302,
        `${base}/verify-email?account=${encodeURIComponent(query.accountId)}&error=invalid`,
      );
      return;
    }
    res.cookie(
      SESSION_COOKIE_NAME,
      outcome.cookieValue,
      this.sessionService.cookieOptions,
    );
    res.redirect(302, `${base}/?social=ok`);
  }

  private async currentSession(req: Request): Promise<Session | null> {
    const raw = (req.cookies as Record<string, string | undefined>)[
      SESSION_COOKIE_NAME
    ];
    return this.sessionService.resolveSessionFromCookie(raw);
  }
}