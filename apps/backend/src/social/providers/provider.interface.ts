/**
 * Provider abstraction — a pluggable OAuth provider implemented by GitHub and
 * Discord. Each provider owns its authorization URL, code exchange, profile
 * fetch and membership gating logic.
 */

import type { SocialProviderId, SocialProfile, SocialTokenResult } from "../social.types.js";

/** Inputs common to every provider's authorization URL. */
export interface AuthorizationUrlInput {
  /** Random per-request `state` value (CSRF / session binding). */
  state: string;
  /** Exact redirect URI the provider may return the code to. */
  redirectUri: string;
  /** PKCE `code_challenge` (S256), required by providers using PKCE. */
  codeChallenge?: string;
}

/** OAuth client credentials, resolved through the settings layer. */
export interface ProviderOauthConfig {
  clientId: string;
  clientSecret: string;
}

/** A pluggable social OAuth provider. */
export interface SocialProvider {
  readonly id: SocialProviderId;
  /** Whether the authorization code flow requires PKCE S256. */
  readonly requiresPkce: boolean;
  /** Builds the provider's authorization URL. */
  authorizationUrl(input: AuthorizationUrlInput): Promise<string>;
  /** Exchanges an authorization code for a token. */
  exchangeCode(input: {
    code: string;
    redirectUri: string;
    codeVerifier?: string;
  }): Promise<SocialTokenResult>;
  /** Resolves the {@link SocialProfile} for an access token. */
  fetchProfile(accessToken: string): Promise<SocialProfile>;
  /**
   * Validates org/guild/role membership gating for sign-in and sign-up.
   * Implementations no-op when no gate is configured on the provider.
   */
  assertMembership(accessToken: string): Promise<void>;
}

/** Provider instance token used to inject every registered provider. */
export const SOCIAL_PROVIDERS = Symbol("SOCIAL_PROVIDERS");