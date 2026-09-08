/**
 * Cryptographic and random-value helpers.
 */

/**
 * Encodes bytes as an unpadded base64url string (RFC 4648 §5).
 */
export function toBase64Url(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Generates a cryptographically secure random token as an unpadded base64url
 * string.
 */
export function randomToken(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return toBase64Url(arr);
}

/**
 * Generates an OAuth 2.0 `state` value (RFC 6749 §4.1.1).
 */
export function generateState(): string {
  return randomToken();
}

/**
 * Generates an OpenID Connect `nonce` value (OIDC Core §3.1.2.1).
 */
export function generateNonce(): string {
  return randomToken();
}
