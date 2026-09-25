/**
 * Platform settings service — resolves effective configuration from the
 * `PlatformSetting` table layered over the environment defaults.
 *
 * Values seeded from environment variables at bootstrap act as defaults; an
 * explicit non-null row overrides them at runtime (admin settings screen). A
 * `null` row — or no row at all — means "fall back to the environment".
 *
 * This is the single place that defines how an override is read and
 * normalized. Enforcement code must resolve through here rather than reading
 * {@link AppConfig} directly, otherwise an override saved in the admin UI
 * would be displayed but never applied.
 */

import { Inject, Injectable } from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "./config.js";
import { PrismaService } from "../prisma/prisma.service.js";

/** Setting key for the LDAP-eligibility email domain allow-list. */
export const ALLOWED_DOMAINS_KEY = "auth.allowedDomains";

/** Setting key for the frontend/callback origin used by social flows. */
export const SOCIAL_REDIRECT_BASE_URL_KEY = "auth.socialRedirectBaseUrl";

/** Trims, lowercases and de-duplicates a list of email domains. */
function normalizeDomains(values: readonly unknown[]): string[] {
  const domains = values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
  return [...new Set(domains)];
}

@Injectable()
export class PlatformSettingsService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Reads a raw `PlatformSetting` value. Returns `undefined` when no row (or a
   * `null` row) exists, meaning "fall back to the environment default".
   */
  async read(key: string): Promise<unknown> {
    const row = await this.prisma.platformSetting.findUnique({ where: { key } });
    return row?.value ?? undefined;
  }

  /**
   * Resolves the effective email domain allow-list that gates LDAP features.
   *
   * Accepts either a JSON array of domains or a comma-separated string (the
   * `ALLOWED_DOMAINS` env format, for convenience when editing the override).
   * An empty list is honoured and disables LDAP features entirely — it is not
   * treated as "unset", because an explicit empty override is a deliberate
   * choice the admin made.
   */
  async getAllowedDomains(): Promise<string[]> {
    const override = await this.read(ALLOWED_DOMAINS_KEY);
    if (Array.isArray(override)) {
      return normalizeDomains(override);
    }
    if (typeof override === "string") {
      return normalizeDomains(override.split(","));
    }
    return normalizeDomains(this.config.allowedDomains);
  }

  /**
   * Resolves the origin used to build social callback URLs, the verification
   * link and the post-callback frontend redirects. A non-http(s) or empty
   * override is ignored rather than breaking every social redirect.
   */
  async getSocialRedirectBaseUrl(): Promise<string> {
    const override = await this.read(SOCIAL_REDIRECT_BASE_URL_KEY);
    if (typeof override === "string") {
      const trimmed = override.trim();
      if (/^https?:\/\//i.test(trimmed)) {
        return trimmed;
      }
    }
    return this.config.socialRedirectBaseUrl;
  }

  /** The redirect base URL without a trailing slash, for building paths. */
  async getSocialRedirectOrigin(): Promise<string> {
    return (await this.getSocialRedirectBaseUrl()).replace(/\/$/, "");
  }
}
