/**
 * Shared OIDC types used across the SDK.
 */

/**
 * Method used to authenticate the client to the token endpoint.
 *
 * Either the secret is sent in the request body (`client_secret_post`) or via
 * the HTTP `Authorization` header (`client_secret_basic`). The SDK never
 * chooses one on its own — it only uses the method the caller picks.
 */
export type TokenEndpointAuthMethod =
  "client_secret_post" | "client_secret_basic";

/**
 * Options required to construct an {@link OidcClient}.
 *
 * Every secret-bearing option (such as `clientSecret`) is supplied here by the
 * caller; the client creates or stores no credentials on its own.
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
   * Omitted for public clients (PKCE-only).
   */
  clientSecret?: string;

  /**
   * How the client secret is sent to the token endpoint.
   * @default "client_secret_post"
   */
  tokenEndpointAuthMethod?: TokenEndpointAuthMethod;

  /**
   * Scopes requested during the authorization flow.
   * @default ["openid", "profile", "email"]
   */
  scopes?: string[];

  /**
   * Full callback URL on the consumer side. Used as the default redirect URI
   * in {@link OidcClient.startAuthFlow} when none is passed.
   */
  redirectUri?: string;

  /**
   * Timeout applied to every HTTP request made by the client, in milliseconds.
   * @default 15000
   */
  requestTimeoutMs?: number;

  /**
   * How long a fetched discovery document stays valid, in milliseconds.
   * @default 3600000
   */
  discoveryCacheTtlMs?: number;

  /**
   * How long a fetched JWKS stays valid, in milliseconds.
   * @default 3600000
   */
  jwksCacheTtlMs?: number;

  /**
   * Allowed leeway, in seconds, accepted for `exp`, `nbf` and `iat` claims
   * while verifying ID tokens.
   * @default 0
   */
  clockToleranceSeconds?: number;

  /**
   * Algorithms allowed to sign ID tokens. The provider's
   * `id_token_signing_alg_values_supported` (from discovery) takes precedence
   * when this is not set.
   * @default ["RS256", "ES256"]
   */
  algorithms?: string[];

  /**
   * Optional custom fetch implementation (useful for tests or runtimes that
   * need a specific HTTP stack).
   */
  fetch?: typeof fetch;
}

/**
 * PKCE (RFC 7636) code verifier / challenge pair.
 */
export interface PkcePair {
  /**
   * High-entropy random string kept secret by the consumer.
   */
  verifier: string;
  /**
   * S256 challenge derived from the verifier, sent with the auth request.
   */
  challenge: string;
}

/**
 * The discovered OIDC provider metadata.
 * @see https://openid.net/specs/openid-connect-discovery-1_0.html#ProviderMetadata
 */
export interface OidcDiscovery {
  /**
   * The provider's canonical issuer identifier.
   */
  issuer: string;

  /**
   * Authorization endpoint URL.
   */
  authorization_endpoint: string;

  /**
   * Token endpoint URL.
   */
  token_endpoint: string;

  /**
   * Userinfo endpoint URL.
   */
  userinfo_endpoint?: string;

  /**
   * JWKS URL used to verify ID tokens.
   */
  jwks_uri?: string;

  /**
   * RP-Initiated Logout endpoint URL (OIDC RP-Initiated Logout 1.0).
   */
  end_session_endpoint?: string;

  /**
   * Supported response types.
   */
  response_types_supported?: string[];

  /**
   * Supported response modes.
   */
  response_modes_supported?: string[];

  /**
   * Supported subject identifier types.
   */
  subject_types_supported?: string[];

  /**
   * JWS algorithms allowed for signing ID tokens.
   */
  id_token_signing_alg_values_supported?: string[];

  /**
   * Client authentication methods supported by the token endpoint.
   */
  token_endpoint_auth_methods_supported?: string[];

  /**
   * Scopes supported by the provider.
   */
  scopes_supported?: string[];

  /**
   * Any additional non-standard metadata members.
   */
  [key: string]: unknown;
}

/**
 * Result of exchanging an authorization code (or refreshing) for tokens.
 */
export interface TokenResponse {
  /**
   * OAuth 2.0 access token.
   */
  access_token: string;

  /**
   * Token type, typically `Bearer`.
   */
  token_type: string;

  /**
   * Access token lifetime in seconds.
   */
  expires_in: number;

  /**
   * Refresh token, when the provider issues one.
   */
  refresh_token?: string;

  /**
   * OpenID Connect ID token (JWT).
   */
  id_token: string;

  /**
   * Granted scope, when returned by the provider.
   */
  scope?: string;
}

/**
 * User claims returned from the userinfo endpoint.
 */
export interface UserInfo {
  /**
   * Subject identifier, stable across sessions.
   */
  sub: string;

  /**
   * Verified email address.
   */
  email?: string;

  /**
   * Whether the email address was verified.
   */
  email_verified?: boolean;

  /**
   * Display name.
   */
  name?: string;

  /**
   * Given (first) name.
   */
  given_name?: string;

  /**
   * Family (last) name.
   */
  family_name?: string;

  /**
   * Profile picture URL.
   */
  picture?: string;

  /**
   * Locale.
   */
  locale?: string;

  /**
   * Group membership, when exposed by the provider.
   */
  groups?: string[];

  /**
   * Role, when exposed by the provider.
   */
  role?: string;
}

/**
 * Claims verified from an ID token.
 *
 * Includes the standard OIDC claims plus any custom/extension claims carried
 * by the provider.
 */
export interface LoginClaims {
  /**
   * Subject identifier, identical for a user across clients.
   */
  sub: string;

  /**
   * Issuer that signed the token.
   */
  iss?: string;

  /**
   * Audience(s) the token was issued for.
   */
  aud?: string | string[];

  /**
   * Expiration timestamp (seconds since epoch).
   */
  exp?: number;

  /**
   * Not-before timestamp (seconds since epoch).
   */
  nbf?: number;

  /**
   * Issued-at timestamp (seconds since epoch).
   */
  iat?: number;

  /**
   * Time of the original end-user authentication (seconds since epoch).
   */
  auth_time?: number;

  /**
   * One-time value bound to the authorization request by the consumer.
   */
  nonce?: string;

  /**
   * Authorized party (the client the token was issued to).
   */
  azp?: string;

  /**
   * Verified email address.
   */
  email?: string;

  /**
   * Whether the email address was verified.
   */
  email_verified?: boolean;

  /**
   * Display name.
   */
  name?: string;

  /**
   * Given (first) name.
   */
  given_name?: string;

  /**
   * Family (last) name.
   */
  family_name?: string;

  /**
   * Preferred username.
   */
  preferred_username?: string;

  /**
   * Profile picture URL.
   */
  picture?: string;

  /**
   * Locale.
   */
  locale?: string;

  /**
   * Group membership, when exposed by the provider.
   */
  groups?: string[];

  /**
   * Role, when exposed by the provider.
   */
  role?: string;

  /**
   * Any additional/custom claims.
   */
  [key: string]: unknown;
}

/**
 * Options for {@link OidcClient.startAuthFlow}.
 */
export interface AuthFlowOptions {
  /**
   * The consumer's registered callback URL.
   */
  redirectUri: string;

  /**
   * Optional prompt parameter forwarded to the provider.
   */
  prompt?: "none" | "login" | "consent" | "select_account";

  /**
   * OAuth 2.0 state to bind the response to this flow. Generated when omitted.
   */
  state?: string;

  /**
   * OIDC nonce bound to the returned tokens. Generated when omitted.
   */
  nonce?: string;
}

/**
 * Everything a consumer needs to start and finish an authorization flow.
 */
export interface AuthFlowResult {
  /**
   * Authorization request URL the end user should be redirected to.
   */
  url: string;

  /**
   * PKCE verifier to send back at the callback.
   */
  verifier: string;

  /**
   * State to compare against the callback's `state` query parameter.
   */
  state: string;

  /**
   * Nonce to pass to ID token verification at the callback.
   */
  nonce: string;
}

/**
 * Options for {@link OidcClient.verifyIdToken}.
 */
export interface VerifyIdTokenOptions {
  /**
   * Nonce to require inside the ID token. Enforced when provided.
   */
  nonce?: string;

  /**
   * Expected audience. Defaults to the configured `clientId`.
   */
  audience?: string | string[];

  /**
   * Algorithms allowed to sign the token. Defaults to the configured
   * `algorithms` or to `id_token_signing_alg_values_supported` from discovery.
   */
  algorithms?: string[];

  /**
   * Clock leeway in seconds. Overrides `clockToleranceSeconds`.
   */
  clockTolerance?: number;
}

/**
 * Result returned after processing the authorization callback.
 */
export interface CallbackResult {
  /**
   * Raw token response from the token endpoint.
   */
  tokens: TokenResponse;

  /**
   * Verified ID token claims.
   */
  claims: LoginClaims;

  /**
   * Profile fetched from the userinfo endpoint.
   */
  user: UserInfo;
}
