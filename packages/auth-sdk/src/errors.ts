/**
 * Error model for the SDK, mirroring the `AuthApiError` convention used by
 * `@inft/auth-core`.
 */

/**
 * Machine-readable error codes raised by the SDK.
 */
export const OIDC_ERROR_CODES = {
  /** `issuerUrl` or `clientId` was not provided at construction time. */
  MISSING_OPTION: "missing_option",
  /** The redirect URI could not be resolved. */
  MISSING_REDIRECT_URI: "missing_redirect_uri",
  /** The discovery endpoint could not be fetched. */
  DISCOVERY_FAILED: "discovery_failed",
  /** The token endpoint rejected the authorization code exchange. */
  TOKEN_EXCHANGE_FAILED: "token_exchange_failed",
  /** The token endpoint rejected the refresh token grant. */
  REFRESH_FAILED: "refresh_failed",
  /** The userinfo endpoint could not be fetched. */
  USERINFO_FAILED: "userinfo_failed",
  /** The provider does not advertise a `jwks_uri` or it could not be fetched. */
  JWKS_UNAVAILABLE: "jwks_unavailable",
  /** Signature or claim verification of the ID token failed. */
  ID_TOKEN_INVALID: "id_token_invalid",
  /** The `nonce` claim in the ID token does not match the expected value. */
  NONCE_MISMATCH: "nonce_mismatch",
  /** The provider does not advertise an `end_session_endpoint`. */
  LOGOUT_NOT_SUPPORTED: "logout_not_supported",
} as const;

/**
 * Union of all OIDC error codes.
 */
export type OidcErrorCode =
  (typeof OIDC_ERROR_CODES)[keyof typeof OIDC_ERROR_CODES];

/**
 * Error raised by the SDK for protocol, network and validation failures.
 */
export class OidcError extends Error {
  constructor(
    message: string,
    /** Machine-readable error code. */
    readonly code: OidcErrorCode,
    /** HTTP status code when the failure originated from an endpoint. */
    readonly status?: number,
    /** Underlying cause, when one exists. */
    readonly cause?: unknown,
  ) {
    super(message, cause ? { cause } : undefined);
    this.name = "OidcError";
  }
}
