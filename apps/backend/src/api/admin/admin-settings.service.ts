/**
 * Admin settings service — effective values with environment defaults.
 *
 * Values seeded from environment variables act as defaults; an explicit
 * non-null `PlatformSetting` row overrides them at runtime. Secrets are never
 * returned in plain text — only their configured state.
 */

import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { DOMAIN_ROOT } from "@inftkr/shared";
import { APP_CONFIG, type AppConfig } from "../../config/config.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { SETTING_DEFINITIONS, findSettingDefinition } from "./setting-registry.js";

export interface EffectiveSetting {
  key: string;
  group: string;
  label: string;
  value?: unknown;
  configured?: boolean;
  source: "env" | "override";
  requiresRestart: boolean;
  secret: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

@Injectable()
export class AdminSettingsService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly prisma: PrismaService,
  ) {}

  /** Returns every registered setting with its effective value. */
  async list(): Promise<EffectiveSetting[]> {
    const rows = await this.prisma.platformSetting.findMany();
    const byKey = new Map(rows.map((r) => [r.key, r]));
    return SETTING_DEFINITIONS.map((def) => {
      const row = byKey.get(def.key);
      const override = row?.value ?? undefined;
      const envDefault = this.envDefault(def.key);
      const effective = override !== undefined ? override : envDefault;
      const base = {
        key: def.key,
        group: def.group,
        label: def.label,
        source: (override !== undefined ? "override" : "env") as "env" | "override",
        requiresRestart: def.requiresRestart,
        secret: def.secret,
        updatedAt: row?.updatedAt ? row.updatedAt.toISOString() : undefined,
        updatedBy: row?.updatedBy ?? undefined,
      };
      if (def.secret) {
        return { ...base, configured: effective !== undefined && effective !== null && effective !== "" };
      }
      return { ...base, value: (effective as unknown) ?? null };
    });
  }

  /**
   * Sets or clears an override. A `null` value deletes the row (env fallback).
   */
  async set(key: string, value: unknown, updatedBy?: string): Promise<EffectiveSetting> {
    const def = findSettingDefinition(key);
    if (!def) {
      throw new BadRequestException(`Unknown setting "${key}"`);
    }
    if (value === null || value === undefined) {
      await this.prisma.platformSetting.deleteMany({ where: { key } });
    } else {
      await this.prisma.platformSetting.upsert({
        where: { key },
        create: { key, value: value as object, updatedBy },
        update: { value: value as object, updatedBy },
      });
    }
    const list = await this.list();
    const entry = list.find((e) => e.key === key);
    if (!entry) {
      throw new BadRequestException(`Unknown setting "${key}"`);
    }
    return entry;
  }

  /** Public deployment metadata for the WebFinger/callback info panel. */
  meta(): { issuerUrl: string; rootDomain: string; allowedDomains: string[]; githubCallbackUrl: string; discordCallbackUrl: string } {
    const base = this.config.socialRedirectBaseUrl.replace(/\/$/, "");
    return {
      issuerUrl: this.config.issuerUrl,
      rootDomain: DOMAIN_ROOT,
      allowedDomains: this.config.allowedDomains,
      githubCallbackUrl: `${base}/api/v1/auth/social/github/callback`,
      discordCallbackUrl: `${base}/api/v1/auth/social/discord/callback`,
    };
  }

  private envDefault(key: string): unknown {
    switch (key) {
      case "social.github.enabled":
        return Boolean(this.config.githubClientId && this.config.githubClientSecret);
      case "social.github.clientId":
        return this.config.githubClientId ?? null;
      case "social.github.clientSecret":
        return this.config.githubClientSecret ?? null;
      case "social.github.org":
        return this.config.githubOrg ?? null;
      case "social.discord.enabled":
        return Boolean(this.config.discordClientId && this.config.discordClientSecret);
      case "social.discord.clientId":
        return this.config.discordClientId ?? null;
      case "social.discord.clientSecret":
        return this.config.discordClientSecret ?? null;
      case "social.discord.guildId":
        return this.config.discordGuildId ?? null;
      case "social.discord.roleIds":
        return this.config.discordRoleIds;
      case "oidc.tailscale.clientSecret":
        return this.config.tailscaleClientSecret ?? null;
      case "smtp.host":
        return this.config.smtpHost ?? null;
      case "smtp.port":
        return this.config.smtpPort;
      case "smtp.secure":
        return this.config.smtpSecure;
      case "smtp.user":
        return this.config.smtpUser ?? null;
      case "smtp.password":
        return this.config.smtpPassword ?? null;
      case "smtp.from":
        return this.config.smtpFrom ?? null;
      case "auth.allowedDomains":
        return this.config.allowedDomains;
      case "auth.socialRedirectBaseUrl":
        return this.config.socialRedirectBaseUrl;
      default:
        return null;
    }
  }
}
