/**
 * Shared OIDC types used across the SDK.
 */

/**
 * Options required to construct an {@link OidcClient}.
 */
export interface OidcClientOptions {
  /**
   * OIDC issuer URL, e.g. `https://auth.inft.kr`.
   */
  issuerUrl: string;

  /**
   * The registered OAuth 2.0 client identifier.
   */
  clientId: string;

  /**
   * The registered OAuth 2.0 client secret, if the client is confidential.
   */
  clientSecret?: string;

  /**
   * Callback path on the consumer side, e.g. `/auth/callback`.
   */
  redirectPath?: string;

  /**
   * Scopes requested during the authorization flow.
   * @default ["openid", "profile", "email"]
   */
  scopes?: string[];
}

/**
 * PKCE (RFC 7636) code verifier / challenge pair.
 */
export interface PkcePair {
  verifier: string;
  challenge: string;
}

/**
 * The discovered OIDC provider metadata.
 * @see https://openid.net/specs/openid-connect-discovery-1_0.html#ProviderMetadata
 */
export interface OidcDiscovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
  jwks_uri?: string;
  response_types_supported?: string[];
  subject_types_supported?: string[];
  id_token_signing_alg_values_supported?: string[];
}

/**
 * Result of exchanging an authorization code for tokens.
 */
export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  id_token: string;
  scope?: string;
}

/**
 * User claims returned from the userinfo endpoint.
 */
export interface UserInfo {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  locale?: string;
  groups?: string[];
  role?: string;
}

/**
 * Result returned after processing the authorization callback.
 */
export interface CallbackResult {
  tokens: TokenResponse;
  user: UserInfo;
}