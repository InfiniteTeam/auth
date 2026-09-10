/**
 * Social settings service — resolves provider OAuth credentials, gating rules
 * and enabled state.
 *
 * Platform-level settings are stored in the `PlatformSetting` table. Values
 * seeded from environment variables at bootstrap act as defaults; an explicit
 * non-null row in `PlatformSetting` overrides them at runtime (server settings
 * screen). A `null` row means "fall back to the environment default".
 */

import { Inject, Injectable } from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "../config/config.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { SocialConfigurationError } from "./social.types.js";
import type { SocialProviderId } from "./social.types.js";
import type { ProviderOauthConfig } from "./providers/provider.interface.js";

/** GitHub membership gate configuration. */
export interface GithubGateConfig {
  /** Organization id that gates sign-in/signup. */
  org?: string;
}

/** Discord membership gate configuration. */
export interface DiscordGateConfig {
  /** Server (guild) id that gates sign-in/signup. */
  guildId?: string;
  /** Role ids that additionally gate sign-in/signup. */
  roleIds: string[];
}

/** Fully resolved per-provider configuration. */
export interface SocialProviderConfig {
  readonly provider: SocialProviderId;
  readonly enabled: boolean;
  readonly oauth: ProviderOauthConfig;
  readonly gate: GithubGateConfig | DiscordGateConfig;
}

/** Setting key prefixes per provider. */
const KEYS = {
  github: {
    enabled: "social.github.enabled",
    clientId: "social.github.clientId",
    clientSecret: "social.github.clientSecret",
    org: "social.github.org",
  },
  discord: {
    enabled: "social.discord.enabled",
    clientId: "social.discord.clientId",
    clientSecret: "social.discord.clientSecret",
    guildId: "social.discord.guildId",
    roleIds: "social.discord.roleIds",
  },
} as const;

@Injectable()
export class SocialSettingsService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Resolves the effective OAuth credentials for a provider, applying any
   * `PlatformSetting` override. Falls back to the environment defaults unless
   * an explicit row overrides them. Throws when neither source has a value.
   */
  async getProviderOauth(provider: SocialProviderId): Promise<ProviderOauthConfig> {
    const [clientId, clientSecret] = await Promise.all([
      this.read(KEYS[provider].clientId),
      this.read(KEYS[provider].clientSecret),
    ]);
    const envClientId = this.envClientId(provider);
    const envClientSecret = this.envClientSecret(provider);
    const effectiveClientId =
      typeof clientId === "string" ? clientId : envClientId;
    const effectiveClientSecret =
      typeof clientSecret === "string" ? clientSecret : envClientSecret;
    if (
      typeof effectiveClientId !== "string" ||
      typeof effectiveClientSecret !== "string"
    ) {
      throw new SocialConfigurationError(provider);
    }
    return { clientId: effectiveClientId, clientSecret: effectiveClientSecret };
  }

  /**
   * Resolves whether a provider is enabled. Falls back to "configured in the
   * environment" unless an explicit `PlatformSetting` boolean overrides it.
   */
  async isEnabled(provider: SocialProviderId): Promise<boolean> {
    const [override, clientId, clientSecret] = await Promise.all([
      this.read(KEYS[provider].enabled),
      this.read(KEYS[provider].clientId),
      this.read(KEYS[provider].clientSecret),
    ]);
    const envEnabled =
      Boolean(this.envClientId(provider) && this.envClientSecret(provider)) ||
      (typeof clientId === "string" && typeof clientSecret === "string");
    return typeof override === "boolean" ? override : envEnabled;
  }

  /** Resolves the GitHub membership gate. */
  async getGithubGate(): Promise<GithubGateConfig> {
    const org = await this.read(KEYS.github.org);
    return { org: typeof org === "string" ? org : this.config.githubOrg || undefined };
  }

  /** Resolves the Discord membership gate. */
  async getDiscordGate(): Promise<DiscordGateConfig> {
    const [guildId, roleIds] = await Promise.all([
      this.read(KEYS.discord.guildId),
      this.read(KEYS.discord.roleIds),
    ]);
    const roles = Array.isArray(roleIds) ? roleIds.filter((v) => typeof v === "string") : [];
    return {
      guildId:
        typeof guildId === "string" ? guildId : this.config.discordGuildId || undefined,
      roleIds: roles.length ? (roles as string[]) : this.config.discordRoleIds,
    };
  }

  /**
   * Reads a raw `PlatformSetting` value. Returns `undefined` when no row (or a
   * `null` row) exists, meaning "fall back to the environment default".
   */
  private async read(key: string): Promise<unknown> {
    const row = await this.prisma.platformSetting.findUnique({ where: { key } });
    return row?.value ?? undefined;
  }

  private envClientId(provider: SocialProviderId): string | undefined {
    return provider === "github"
      ? this.config.githubClientId
      : this.config.discordClientId;
  }

  private envClientSecret(provider: SocialProviderId): string | undefined {
    return provider === "github"
      ? this.config.githubClientSecret
      : this.config.discordClientSecret;
  }
}