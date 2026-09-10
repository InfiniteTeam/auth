/**
 * Social sign-in service — orchestrates the authorization-code flow for
 * GitHub and Discord, deciding between four outcomes at the callback:
 *
 * - **connect** — an authenticated session linked the provider to the user.
 * - **login** — a known, verified account signed in.
 * - **verification** — a brand-new account must confirm its email first.
 * - **error** — any gate/exchange failure, mapped to a stable error code.
 *
 * The mode is derived from the presence of a session (and the existence/
 * verification state of the `Account` row), never from a client-supplied
 * parameter.
 */

import { Inject, Injectable, Logger } from "@nestjs/common";
import type { AuthProvider, Session } from "@inftkr/shared";
import { APP_CONFIG, type AppConfig } from "../config/config.js";
import { SnowflakeGenerator } from "../common/snowflake.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { SessionService } from "../session/session.service.js";
import { LldapService } from "../lldap/lldap.service.js";
import { isEmailDomainAllowed } from "./domain.util.js";
import { SOCIAL_PROVIDERS } from "./providers/provider.interface.js";
import type { SocialProvider } from "./providers/provider.interface.js";
import { OAuthStateService } from "./oauth-state.service.js";
import { VerificationService } from "./verification.service.js";
import { MailNotConfiguredError } from "./mail.service.js";
import {
  SocialConfigurationError,
  SocialMembershipError,
  SocialOAuthError,
  type SocialProfile,
  type SocialProviderId,
} from "./social.types.js";

/** Stable error codes surfaced on the `/social/error` page. */
export type SocialErrorCode =
  | "provider_disabled"
  | "invalid_state"
  | "provider_error"
  | "already_linked"
  | "membership_required"
  | "email_exists"
  | "email_domain_not_allowed"
  | "verification_unavailable";

/** Discriminated outcome of a callback handling run. */
export type SocialCallbackOutcome =
  | { kind: "login"; session: Session; cookieValue: string }
  | { kind: "connect" }
  | { kind: "verification"; accountId: string; email: string }
  | { kind: "error"; code: SocialErrorCode };

/** Result of a verification completion (login after email confirm). */
export type SocialVerifyOutcome =
  | { ok: true; session: Session; cookieValue: string }
  | { ok: false; reason: "account_not_found" | "invalid_input" };

@Injectable()
export class SocialService {
  private readonly logger = new Logger(SocialService.name);
  private readonly snowflake: SnowflakeGenerator;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(SOCIAL_PROVIDERS)
    private readonly providers: readonly SocialProvider[],
    private readonly oauthState: OAuthStateService,
    private readonly verification: VerificationService,
    private readonly sessionService: SessionService,
    private readonly lldap: LldapService,
    private readonly prisma: PrismaService,
  ) {
    this.snowflake = new SnowflakeGenerator({
      epoch: config.snowflakeEpochMs,
      workerId: config.snowflakeWorkerId,
    });
  }

  /** The exact redirect URI registered with the provider. */
  redirectUri(provider: SocialProviderId): string {
    return `${this.config.socialRedirectBaseUrl}/api/v1/auth/social/${provider}/callback`;
  }

  /**
   * Starts the flow: mints a signed state packet and builds the provider
   * authorization URL. The state cookie must be set by the caller.
   */
  async start(
    provider: SocialProviderId,
    connectMode: boolean,
  ): Promise<{ authorizationUrl: string; cookieValue: string }> {
    const impl = this.providerOf(provider);
    const created = this.oauthState.create(provider, impl.requiresPkce);
    const authorizationUrl = await impl.authorizationUrl({
      state: created.state,
      redirectUri: this.redirectUri(provider),
      codeChallenge: created.codeVerifier,
    });
    return { authorizationUrl, cookieValue: created.cookieValue };
  }

  /**
   * Handles the provider callback. `session` is the current session resolved
   * from the requester's cookie (or `null`).
   */
  async callback(
    provider: SocialProviderId,
    query: { code?: string; state?: string; error?: string },
    rawStateCookie: string | undefined | null,
    session: Session | null,
  ): Promise<SocialCallbackOutcome> {
    const impl = this.providerOf(provider);
    const payload = this.oauthState.verify(rawStateCookie, query.state ?? "");
    if (!payload) {
      this.logger.warn(
        `Social callback rejected: invalid state (provider=${provider})`,
      );
      return { kind: "error", code: "invalid_state" };
    }
    if (query.error || !query.code) {
      this.logger.warn(
        `Social callback rejected: no code (provider=${provider}, error=${query.error ?? "none"})`,
      );
      return { kind: "error", code: "provider_error" };
    }

    let profile: SocialProfile;
    let accessToken: string;
    try {
      const token = await impl.exchangeCode({
        code: query.code,
        redirectUri: this.redirectUri(provider),
        codeVerifier: payload.codeVerifier,
      });
      accessToken = token.accessToken;
      profile = await impl.fetchProfile(accessToken);
    } catch (error) {
      if (error instanceof SocialOAuthError) {
        this.logger.warn(
          `Social OAuth failed for ${provider}: ${error.message}`,
        );
        return { kind: "error", code: "provider_error" };
      }
      throw error;
    }

    if (session) {
      return this.connectAccount(impl, profile, session.user.userId);
    }

    try {
      await impl.assertMembership(accessToken);
    } catch (error) {
      if (error instanceof SocialMembershipError) {
        return { kind: "error", code: "membership_required" };
      }
      if (error instanceof SocialOAuthError) {
        return { kind: "error", code: "provider_error" };
      }
      throw error;
    }

    return this.loginOrSignup(impl, profile);
  }

  /**
   * Completes email verification for a sign-up account: creates the lldap
   * user when missing, then signs the user in.
   */
  async verify(accountId: string, code: string): Promise<SocialVerifyOutcome> {
    const result = await this.verification.verifyCode(accountId, code);
    if (!result.ok) {
      return { ok: false, reason: "invalid_input" };
    }
    return this.finalizeAccount(accountId);
  }

  /** Verifies via the one-time link token from the email. */
  async verifyLink(accountId: string, token: string): Promise<SocialVerifyOutcome> {
    const result = await this.verification.verifyToken(accountId, token);
    if (!result.ok) {
      return { ok: false, reason: "invalid_input" };
    }
    return this.finalizeAccount(accountId);
  }

  /** (Re)sends the verification email for an unverified account. */
  async resendVerification(
    accountId: string,
  ): Promise<{ ok: true } | { ok: false; reason: string }> {
    try {
      const result = await this.verification.send(accountId);
      return result.ok ? { ok: true } : { ok: false, reason: result.reason };
    } catch (error) {
      if (error instanceof MailNotConfiguredError) {
        return { ok: false, reason: "mail_unavailable" };
      }
      throw error;
    }
  }

  /** Whether an account is a pending verification for the given provider. */
  async isPendingVerification(
    accountId: string,
    provider: SocialProviderId,
  ): Promise<boolean> {
    return this.verification.isPendingVerification(accountId, provider);
  }

  private providerOf(id: SocialProviderId): SocialProvider {
    const impl = this.providers.find((provider) => provider.id === id);
    if (!impl) {
      throw new SocialConfigurationError(id);
    }
    return impl;
  }

  /**
   * Connect mode: the provider account is linked to the current session.
   * Skips membership and email gates — the user is already authenticated.
   */
  private async connectAccount(
    impl: SocialProvider,
    profile: SocialProfile,
    userId: string,
  ): Promise<SocialCallbackOutcome> {
    const existing = await this.prisma.account.findUnique({
      where: {
        provider_providerUserId: {
          provider: impl.id,
          providerUserId: profile.providerUserId,
        },
      },
    });
    if (existing) {
      return { kind: "error", code: "already_linked" };
    }
    await this.prisma.account.create({
      data: {
        id: this.snowflake.nextIdString(),
        userId,
        provider: impl.id,
        providerUserId: profile.providerUserId,
        email: profile.email,
        name: profile.name || null,
        avatarUrl: profile.avatarUrl,
        verified: true,
        verifiedAt: new Date(),
      },
    });
    return { kind: "connect" };
  }

  /**
   * Login/signup mode (no session): gates by membership, then either signs in
   * a known verified account, resumes a pending verification, or creates a new
   * account that must confirm its email.
   */
  private async loginOrSignup(
    impl: SocialProvider,
    profile: SocialProfile,
  ): Promise<SocialCallbackOutcome> {
    const provider = impl.id;
    const account = await this.prisma.account.findUnique({
      where: {
        provider_providerUserId: {
          provider,
          providerUserId: profile.providerUserId,
        },
      },
    });

    if (account) {
      if (account.verified) {
        return this.signIn(account.userId, provider, {
          email: account.email,
          name: account.name || undefined,
        });
      }
      return this.resumeVerification(account.id, account.email);
    }

    return this.createSignup(provider, profile);
  }

  private async createSignup(
    provider: SocialProviderId,
    profile: SocialProfile,
  ): Promise<SocialCallbackOutcome> {
    if (!profile.email) {
      this.logger.warn(
        `Social sign-up aborted: provider ${provider} returned no verified email`,
      );
      return { kind: "error", code: "provider_error" };
    }
    const lower = profile.email.toLowerCase();

    if (!isEmailDomainAllowed(lower, this.config.allowedDomains)) {
      this.logger.warn(
        `Social sign-up rejected: email domain not allowed (provider=${provider}, email=${lower})`,
      );
      return { kind: "error", code: "email_domain_not_allowed" };
    }

    const lldapCollision = await this.lldap.resolveUidByEmail(lower);
    if (lldapCollision) {
      return { kind: "error", code: "email_exists" };
    }
    const accountCollision = await this.prisma.account.findFirst({
      where: { email: lower, verified: true },
    });
    if (accountCollision) {
      return { kind: "error", code: "email_exists" };
    }

    const account = await this.prisma.account.create({
      data: {
        id: this.snowflake.nextIdString(),
        userId: lower,
        provider,
        providerUserId: profile.providerUserId,
        email: lower,
        name: profile.name || null,
        avatarUrl: profile.avatarUrl,
        verified: false,
      },
    });

    const sent = await this.verification.send(account.id);
    if (!sent.ok) {
      if (sent.reason === "mail_failed") {
        return { kind: "error", code: "verification_unavailable" };
      }
      return { kind: "error", code: "provider_error" };
    }
    return {
      kind: "verification",
      accountId: account.id,
      email: account.email,
    };
  }

  private async resumeVerification(
    accountId: string,
    email: string,
  ): Promise<SocialCallbackOutcome> {
    const sent = await this.verification.send(accountId);
    if (!sent.ok) {
      if (sent.reason === "mail_failed") {
        return { kind: "error", code: "verification_unavailable" };
      }
      if (sent.reason === "already_verified") {
        return { kind: "verification", accountId, email };
      }
      return { kind: "error", code: "provider_error" };
    }
    return { kind: "verification", accountId, email };
  }

  /**
   * Finalizes a verified sign-up: creates the lldap user when missing, then
   * creates a session and its signed cookie.
   */
  private async finalizeAccount(
    accountId: string,
  ): Promise<SocialVerifyOutcome> {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });
    if (!account || !account.verified) {
      return { ok: false, reason: "account_not_found" };
    }
    if (!isEmailDomainAllowed(account.userId, this.config.allowedDomains)) {
      this.logger.warn(
        `Social finalize rejected: email domain not allowed (account=${account.id})`,
      );
      return { ok: false, reason: "invalid_input" };
    }
    const lldapUid = await this.lldap.resolveUidByEmail(account.userId);
    if (!lldapUid) {
      await this.lldap.createUser({
        uid: account.userId,
        email: account.email,
        displayName: account.name || account.email,
      });
    }
    const signed = await this.signIn(account.userId, account.provider as AuthProvider, {
      email: account.email,
      name: account.name || undefined,
    });
    return { ok: true, session: signed.session, cookieValue: signed.cookieValue };
  }

  /**
   * Builds a session + signed cookie for a verified user, mirroring the LDAP
   * login flow (roles/permissions resolved from lldap group membership).
   */
  private async signIn(
    userId: string,
    provider: AuthProvider,
    fallback: { email: string; name?: string },
  ): Promise<{ kind: "login"; session: Session; cookieValue: string }> {
    const user = (await this.lldap.getUserById(userId)) ?? {
      id: userId,
      email: fallback.email,
      name: fallback.name ?? fallback.email,
      roles: ["user"] as const,
      permissions: "0",
    };
    const { session, cookieValue } = await this.sessionService.createSession({
      userId: user.id,
      provider,
      email: user.email,
      name: user.name,
      roles: user.roles,
      permissions: user.permissions,
    });
    return { kind: "login", session, cookieValue };
  }
}