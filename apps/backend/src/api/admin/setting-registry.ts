/**
 * Registry of settable platform settings.
 *
 * Each entry maps a `PlatformSetting` key to its environment default, UI
 * grouping, secrecy and restart behaviour. Only registered keys are readable
 * and writable through the admin settings API.
 */

export interface SettingDefinition {
  /** Setting key (also the `PlatformSetting` row id). */
  key: string;
  /** UI group for sectioning (e.g. `social`, `smtp`, `oidc`). */
  group: string;
  /** Human-readable label. */
  label: string;
  /** Whether the value is secret (masked in reads and logs). */
  secret: boolean;
  /** Whether changing the value requires a server restart. */
  requiresRestart: boolean;
}

/**
 * All settings manageable through the admin API.
 */
export const SETTING_DEFINITIONS: readonly SettingDefinition[] = [
  // Social providers (hot-swappable: read per request).
  { key: "social.github.enabled", group: "social", label: "GitHub enabled", secret: false, requiresRestart: false },
  { key: "social.github.clientId", group: "social", label: "GitHub client ID", secret: false, requiresRestart: false },
  { key: "social.github.clientSecret", group: "social", label: "GitHub client secret", secret: true, requiresRestart: false },
  { key: "social.github.org", group: "social", label: "GitHub organization gate", secret: false, requiresRestart: false },
  { key: "social.discord.enabled", group: "social", label: "Discord enabled", secret: false, requiresRestart: false },
  { key: "social.discord.clientId", group: "social", label: "Discord client ID", secret: false, requiresRestart: false },
  { key: "social.discord.clientSecret", group: "social", label: "Discord client secret", secret: true, requiresRestart: false },
  { key: "social.discord.guildId", group: "social", label: "Discord guild gate", secret: false, requiresRestart: false },
  { key: "social.discord.roleIds", group: "social", label: "Discord role gates", secret: false, requiresRestart: false },
  // OIDC built-in client (requires DB sync + restart to take effect).
  { key: "oidc.tailscale.clientSecret", group: "oidc", label: "Tailscale client secret", secret: true, requiresRestart: true },
  // Email / verification (effective on next send/request).
  { key: "smtp.host", group: "smtp", label: "SMTP host", secret: false, requiresRestart: false },
  { key: "smtp.port", group: "smtp", label: "SMTP port", secret: false, requiresRestart: false },
  { key: "smtp.secure", group: "smtp", label: "SMTP secure", secret: false, requiresRestart: false },
  { key: "smtp.user", group: "smtp", label: "SMTP user", secret: false, requiresRestart: false },
  { key: "smtp.password", group: "smtp", label: "SMTP password", secret: true, requiresRestart: false },
  { key: "smtp.from", group: "smtp", label: "SMTP from address", secret: false, requiresRestart: false },
  // Domains and access policy (restart/external work required).
  { key: "auth.allowedDomains", group: "domains", label: "Allowed email domains", secret: false, requiresRestart: true },
  { key: "auth.socialRedirectBaseUrl", group: "domains", label: "Social redirect base URL", secret: false, requiresRestart: true },
];

/**
 * Finds a setting definition by key.
 */
export function findSettingDefinition(key: string): SettingDefinition | undefined {
  return SETTING_DEFINITIONS.find((def) => def.key === key);
}
