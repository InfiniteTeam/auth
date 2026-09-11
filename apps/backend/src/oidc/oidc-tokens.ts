/**
 * Injection tokens for the OIDC module.
 *
 * Kept in a dedicated file (instead of `oidc.module.ts`) so controllers can
 * inject the shared {@link Provider} without creating a module <-> controller
 * circular import, which breaks ESM evaluation in production builds.
 */

/** Injection token for the shared OIDC {@link Provider}. */
export const OIDC_PROVIDER = Symbol("OIDC_PROVIDER");
