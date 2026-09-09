/**
 * Test fixture builder for {@link AppConfig}. Each unit spec builds its own
 * configuration object; this helper keeps them in sync when config grows.
 */

import type { AppConfig } from "./config.js";

/**
 * Returns a complete {@link AppConfig} with sensible test defaults, overlaid
 * with `overrides`.
 */
export function appConfigFixture(
  overrides: Partial<AppConfig> = {},
): AppConfig {
  return {
    port: 3000,
    nodeEnv: "test",
    issuerUrl: "http://localhost:3000",
    sessionSecret: "test-session-secret",
    jwksPath: "./jwks.json",
    tailscaleClientSecret: "test-client-secret",
    databaseUrl: "postgresql://auth:auth@localhost:5432/auth",
    lldapUrl: "http://localhost:17170",
    lldapAdminDn: "admin",
    lldapAdminPassword: "test",
    lldapAdminGroupName: "admins",
    snowflakeWorkerId: 0,
    snowflakeEpochMs: Date.UTC(2026, 8, 8),
    allowedDomains: ["inft.kr"],
    githubClientId: "github-client-id",
    githubClientSecret: "github-client-secret",
    githubOrg: "InfiniteTeam",
    discordClientId: "discord-client-id",
    discordClientSecret: "discord-client-secret",
    discordGuildId: "guild-id",
    discordRoleIds: ["role-id"],
    smtpHost: "smtp.example.com",
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: "user",
    smtpPassword: "pass",
    smtpFrom: "mailer@example.test",
    socialRedirectBaseUrl: "http://localhost:3000",
    oauthStateTtlMs: 10 * 60 * 1000,
    verificationCodeTtlMs: 10 * 60 * 1000,
    verificationTokenTtlMs: 24 * 60 * 60 * 1000,
    verificationMaxAttempts: 5,
    ...overrides,
  };
}