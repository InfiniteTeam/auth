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
 * Returns `true` when `path` belongs to the oidc-provider routes.
 */
export function isOidcRoute(path: string): boolean {
  return OIDC_ROUTES.some(
    (route) => path === route || path.startsWith(`${route}/`),
  );
}
