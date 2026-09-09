/**
 * @inftkr/auth-sdk
 *
 * OpenID Connect client SDK for consumer services that want to integrate with
 * the inft-auth identity platform (or any OIDC-compliant provider).
 *
 * Includes PKCE-based authorization, ID token verification against the
 * provider's JWKS, token refresh, RP-Initiated logout and userinfo retrieval.
 */

export { OidcClient } from "./client.js";
export { OIDC_ERROR_CODES, OidcError, type OidcErrorCode } from "./errors.js";
export {
  DEFAULT_ID_TOKEN_ALGORITHMS,
  createLocalJwkSet,
  verifyJwt,
  type LocalJwkSet,
  type VerifyJwtParameters,
} from "./jwt.js";
export {
  generateNonce,
  generateState,
  randomToken,
  toBase64Url,
} from "./utils.js";
export type {
  AuthFlowOptions,
  AuthFlowResult,
  CallbackResult,
  LoginClaims,
  OidcClientOptions,
  OidcDiscovery,
  PkcePair,
  TokenEndpointAuthMethod,
  TokenResponse,
  UserInfo,
  VerifyIdTokenOptions,
} from "./types.js";

export { OidcClient as default } from "./client.js";
