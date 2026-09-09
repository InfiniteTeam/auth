/**
 * Shared types for the social sign-in feature (GitHub / Discord).
 */

/** Supported social providers. */
export type SocialProviderId = "github" | "discord";

/** User profile resolved from a provider after code exchange. */
export interface SocialProfile {
  /** User id as reported by the provider. */
  providerUserId: string;
  /** Primary email reported by the provider (empty when refused). */
  email: string;
  /** Display name taken from the provider profile. */
  name: string;
  /** Avatar image URL from the provider (optional). */
  avatarUrl?: string;
}

/** Result of exchanging an authorization code for a token. */
export interface SocialTokenResult {
  /** Access token used to call provider API endpoints. */
  accessToken: string;
  /** Refresh token (Discord only; GitHub OAuth Apps do not issue one). */
  refreshToken?: string;
  /** When the access token expires (Discord). */
  expiresAt?: Date;
  /** Scopes granted to the token. */
  scope?: string;
}

/** Email verification outcome, expressed as a discriminated union. */
export type SocialVerifyResult =
  | { ok: true; accountId: string }
  | { ok: false; reason: SocialVerifyFailure };

export type SocialVerifyFailure =
  | "account_not_found"
  | "code_expired"
  | "code_attempts_exceeded"
  | "invalid_code"
  | "token_expired"
  | "invalid_token";

/** Error thrown when a social provider is not configured. */
export class SocialConfigurationError extends Error {
  constructor(provider: SocialProviderId) {
    super(`Social provider "${provider}" is not configured`);
    this.name = "SocialConfigurationError";
  }
}

/** Error thrown when membership (org/guild/role) gating fails. */
export class SocialMembershipError extends Error {
  constructor(provider: SocialProviderId, scope: string) {
    super(`Social provider "${provider}" requires membership in "${scope}"`);
    this.name = "SocialMembershipError";
  }
}

/** Error thrown when a provider rejects an OAuth exchange or API call. */
export class SocialOAuthError extends Error {
  constructor(provider: SocialProviderId, message = "Social OAuth error") {
    super(message);
    this.name = "SocialOAuthError";
  }
}