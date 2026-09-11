/**
 * OIDC provider route table.
 *
 * These paths are handed to the raw `oidc-provider` Express callback, except
 * the static production interaction endpoint (`/interaction`), which the Nest
 * interaction controller serves through the Nest router. Anything else falls
 * through to the Nest router as well. Kept in lockstep with the `routes`
 * configuration in {@link ../provider.factory}.
 */

/** The interaction endpoint used by the OIDC authorization flow. */
export const OIDC_INTERACTION_ROUTE = "/interaction";

/** Route prefixes handled exclusively by oidc-provider. */
export const OIDC_ROUTES = [
  "/auth",
  "/token",
  "/revoke",
  "/introspect",
  "/userinfo",
  "/session/end",
  "/request",
  "/device/auth",
  "/device/conf",
  "/reg",
  "/bc-authorize",
  "/credential",
  "/challenge",
  "/.well-known/openid-configuration",
  "/.well-known/jwks.json",
  OIDC_INTERACTION_ROUTE,
] as const;

/**
 * Prompt values understood by oidc-provider. Anything else (e.g.
 * `select_account`, which Tailscale always sends) makes the provider reject
 * the authorization request with `invalid_request: unsupported prompt value
 * requested` before any interaction starts.
 */
export const SUPPORTED_OIDC_PROMPTS: ReadonlySet<string> = new Set([
  "none",
  "login",
  "consent",
]);

/**
 * Removes unsupported `prompt` values from an authorization request URL while
 * keeping the supported ones in order. Returns the URL unchanged when there
 * is nothing to strip (including when no `prompt` parameter is present). When
 * only unsupported values remain, the parameter is dropped entirely.
 */
export function stripUnsupportedPrompt(url: string): string {
  const queryIndex = url.indexOf("?");
  if (queryIndex === -1) {
    return url;
  }
  const params = new URLSearchParams(url.slice(queryIndex + 1));
  const prompt = params.get("prompt");
  if (prompt === null) {
    return url;
  }
  const values = prompt.split(/\s+/).filter(Boolean);
  const kept = values.filter((value) => SUPPORTED_OIDC_PROMPTS.has(value));
  if (kept.length === values.length) {
    return url;
  }
  if (kept.length === 0) {
    params.delete("prompt");
  } else {
    params.set("prompt", kept.join(" "));
  }
  return `${url.slice(0, queryIndex + 1)}${params.toString()}`;
}

/**
 * Returns `true` when `path` belongs to the oidc-provider routes.
 */
export function isOidcRoute(path: string): boolean {
  return OIDC_ROUTES.some(
    (route) => path === route || path.startsWith(`${route}/`),
  );
}
