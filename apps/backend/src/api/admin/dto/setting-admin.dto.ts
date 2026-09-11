/**
 * Request/response DTOs for the admin settings API
 * (`/api/v1/admin/settings`, `PlatformSetting`-backed overrides).
 */

import { IsOptional, IsString, MaxLength } from "class-validator";

/**
 * Payload for `PUT /api/v1/admin/settings/:key`.
 * A `null` value deletes the override (falls back to the environment default).
 */
export class UpdateAdminSettingDto {
  /** New override value as a JSON document; `null` clears the override. */
  value: unknown;
}

/**
 * Metadata query for `GET /api/v1/admin/meta` (no DTO fields).
 */
export class AdminMetaDto {
  /** Public OIDC issuer URL. */
  issuerUrl: string;

  /** WebFinger root domain. */
  rootDomain: string;

  /** Email domains allowed to sign in. */
  allowedDomains: string[];

  /** Callback URL registered with GitHub. */
  githubCallbackUrl: string;

  /** Callback URL registered with Discord. */
  discordCallbackUrl: string;
}
