/**
 * Centralised, validated runtime configuration for the backend, loaded from
 * environment variables on bootstrap.
 */

import { DEFAULT_SNOWFLAKE_EPOCH_MS } from "../common/snowflake.js";

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
  /** Snowflake generator worker id (`[0, 1023]`). */
  snowflakeWorkerId: number;
  /** Snowflake epoch in milliseconds (defaults to `2026-09-08T00:00:00Z`). */
  snowflakeEpochMs: number;
  /** Email domains allowed to sign in with LDAP credentials. */
  allowedDomains: string[];
  /** GitHub OAuth App client id. Absent when GitHub sign-in is disabled. */
  githubClientId?: string;
  /** GitHub OAuth App client secret. */
  githubClientSecret?: string;
  /**
   * GitHub organization that membership-gates GitHub sign-in/signup. When set,
   * only members of the organization are accepted.
   */
  githubOrg?: string;
  /** Discord Application client id. Absent when Discord sign-in is disabled. */
  discordClientId?: string;
  /** Discord Application client secret. */
  discordClientSecret?: string;
  /** Discord server (guild) that membership-gates Discord sign-in/signup. */
  discordGuildId?: string;
  /** Role ids that additionally gate Discord sign-in/signup (optional). */
  discordRoleIds: string[];
  /** SMTP host used to send verification emails. Absent when mail is disabled. */
  smtpHost?: string;
  /** SMTP port. */
  smtpPort: number;
  /** Whether SMTP connections are secured with TLS/STARTTLS. */
  smtpSecure: boolean;
  /** SMTP username for authenticated relays (optional). */
  smtpUser?: string;
  /** SMTP password for authenticated relays (optional). */
  smtpPassword?: string;
  /** "From" address used in verification emails. Absent when mail is disabled. */
  smtpFrom?: string;
  /**
   * Base URL used to build social callback and redirect URLs. Defaults to the
   * issuer URL (`issuerUrl`).
   */
  socialRedirectBaseUrl: string;
  /** Lifetime of OAuth `state` packets, in milliseconds. */
  oauthStateTtlMs: number;
  /** Lifetime of the email verification code, in milliseconds. */
  verificationCodeTtlMs: number;
  /** Lifetime of the email verification link token, in milliseconds. */
  verificationTokenTtlMs: number;
  /** Maximum consecutive wrong-code attempts before re-verification is needed. */
  verificationMaxAttempts: number;
}

/** Parses a comma-separated list into a trimmed, de-duplicated array. */
function toList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
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
    tailscaleClientSecret: required(
      "TAILSCALE_CLIENT_SECRET",
      env.TAILSCALE_CLIENT_SECRET,
    ),
    databaseUrl: required("DATABASE_URL", env.DATABASE_URL),
    lldapUrl: required("LLDAP_URL", env.LLDAP_URL),
    lldapAdminDn: required("LLDAP_ADMIN_DN", env.LLDAP_ADMIN_DN),
    lldapAdminPassword: required(
      "LLDAP_ADMIN_PASSWORD",
      env.LLDAP_ADMIN_PASSWORD,
    ),
    lldapAdminGroupName: env.ADMIN_GROUP_NAME ?? "admins",
    snowflakeWorkerId: Number(env.SNOWFLAKE_WORKER_ID ?? 0),
    snowflakeEpochMs: Number(env.SNOWFLAKE_EPOCH_MS ?? DEFAULT_SNOWFLAKE_EPOCH_MS),
    allowedDomains: toList(env.ALLOWED_DOMAINS ?? "inft.kr"),
    githubClientId: env.GITHUB_CLIENT_ID || undefined,
    githubClientSecret: env.GITHUB_CLIENT_SECRET || undefined,
    githubOrg: env.GITHUB_ORG || undefined,
    discordClientId: env.DISCORD_CLIENT_ID || undefined,
    discordClientSecret: env.DISCORD_CLIENT_SECRET || undefined,
    discordGuildId: env.DISCORD_GUILD_ID || undefined,
    discordRoleIds: toList(env.DISCORD_ROLE_IDS),
    smtpHost: env.SMTP_HOST || undefined,
    smtpPort: Number(env.SMTP_PORT ?? 587),
    smtpSecure: env.SMTP_SECURE === "true",
    smtpUser: env.SMTP_USER || undefined,
    smtpPassword: env.SMTP_PASSWORD || undefined,
    smtpFrom: env.SMTP_FROM || undefined,
    socialRedirectBaseUrl: env.SOCIAL_REDIRECT_BASE_URL ?? envelopeIssuer(env),
    oauthStateTtlMs: Number(env.OAUTH_STATE_TTL_MS ?? 10 * 60 * 1000),
    verificationCodeTtlMs: Number(env.VERIFY_CODE_TTL_MS ?? 10 * 60 * 1000),
    verificationTokenTtlMs: Number(env.VERIFY_TOKEN_TTL_MS ?? 24 * 60 * 60 * 1000),
    verificationMaxAttempts: Number(env.VERIFY_MAX_ATTEMPTS ?? 5),
  };
}

/**
 * Resolves the issuer URL for `socialRedirectBaseUrl` without requiring
 * `loadConfig`'s own `required()` checks first.
 */
function envelopeIssuer(env: NodeJS.ProcessEnv): string {
  return env.ISSUER_URL ?? "";
}

/**
 * Injectable value providing the validated {@link AppConfig}.
 */
export const APP_CONFIG = Symbol("APP_CONFIG");
