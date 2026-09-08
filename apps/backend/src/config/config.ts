/**
 * Centralised, validated runtime configuration for the backend, loaded from
 * environment variables on bootstrap.
 */

export interface AppConfig {
  /** HTTP port the server listens on. */
  port: number;
  /** Current environment: `development`, `test` or `production`. */
  nodeEnv: string;
  /** Public issuer URL advertised in the OIDC discovery document. */
  issuerUrl: string;
  /** Secret used to sign the inft_session cookie. */
  sessionSecret: string;
  /** File path where the persistent OIDC JWKS is stored. */
  jwksPath: string;
  /** Client secret for the seeded Tailscale custom OIDC client. */
  tailscaleClientSecret: string;
  /** PostgreSQL connection string for the auth database. */
  databaseUrl: string;
  /** Base URL of the lldap service. */
  lldapUrl: string;
  /** lldap service-account DN used for GraphQL queries. */
  lldapAdminDn: string;
  /** lldap service-account password. */
  lldapAdminPassword: string;
  /** lldap group whose members receive every platform permission. */
  lldapAdminGroupName: string;
}

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Builds the runtime configuration from `process.env`.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: Number(env.PORT ?? 3000),
    nodeEnv: env.NODE_ENV ?? "development",
    issuerUrl: required("ISSUER_URL", env.ISSUER_URL),
    sessionSecret: required("SESSION_SECRET", env.SESSION_SECRET),
    jwksPath: env.OIDC_JWKS_PATH ?? "./jwks.json",
    tailscaleClientSecret: env.TAILSCALE_CLIENT_SECRET ?? "",
    databaseUrl: required("DATABASE_URL", env.DATABASE_URL),
    lldapUrl: required("LLDAP_URL", env.LLDAP_URL),
    lldapAdminDn: required("LLDAP_ADMIN_DN", env.LLDAP_ADMIN_DN),
    lldapAdminPassword: required(
      "LLDAP_ADMIN_PASSWORD",
      env.LLDAP_ADMIN_PASSWORD,
    ),
    lldapAdminGroupName: env.ADMIN_GROUP_NAME ?? "admins",
  };
}

/**
 * Injectable value providing the validated {@link AppConfig}.
 */
export const APP_CONFIG = Symbol("APP_CONFIG");
