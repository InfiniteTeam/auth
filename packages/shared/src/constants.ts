/**
 * Shared constants for the inft-auth platform.
 *
 * These values are the single source of truth for domain names, cookie
 * rules and well-known paths shared by the backend and the frontend.
 */

/**
 * The primary (single) domain that hosts the OIDC issuer, the frontend UI
 * and the internal API.
 */
export const DOMAIN_AUTH = "auth.inft.kr";

/**
 * The root domain. Used by WebFinger discovery (`/.well-known/webfinger`).
 */
export const DOMAIN_ROOT = "inft.kr";

/**
 * Absolute OIDC issuer URL as advertised in the discovery document.
 */
export const OIDC_ISSUER = `https://${DOMAIN_AUTH}`;

/**
 * Name of the signed session cookie set by the backend.
 */
export const SESSION_COOKIE_NAME = "inft_session";

/**
 * Default cookie options applied to the session cookie.
 */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/",
  maxAge: 60 * 60 * 24 * 7, // 7 days
} as const;

/**
 * Well-known WebFinger endpoint path (RFC 7033).
 */
export const WEBFINGER_PATH = "/.well-known/webfinger";

/**
 * URL prefix for the internal REST API served by the backend.
 */
export const API_PREFIX = "/api";