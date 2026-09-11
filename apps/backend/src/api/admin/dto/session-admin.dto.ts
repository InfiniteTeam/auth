/**
 * Request/response DTOs for the admin session API
 * (`/api/v1/admin/sessions`, Prisma-backed).
 */

import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { Type } from "class-transformer";

/**
 * Query parameters for `GET /api/v1/admin/sessions`.
 */
export class ListAdminSessionsQueryDto {
  /** Filter by owner user id (ldap uid). */
  @IsOptional()
  @IsString()
  @MaxLength(256)
  userId?: string;

  /** When true (default), only non-expired, non-revoked sessions. */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  activeOnly?: boolean;

  /** Maximum number of sessions to return (1-200, defaults to 50). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

/**
 * A session row as returned by the admin API.
 */
export class AdminSessionDto {
  /** Session identifier. */
  id: string;

  /** Owner user id (ldap uid). */
  userId: string;

  /** Owner email address. */
  email: string;

  /** Authentication provider used to sign in. */
  provider: string;

  /** ISO 8601 issue timestamp. */
  issuedAt: string;

  /** ISO 8601 expiry timestamp. */
  expiresAt: string;

  /** ISO 8601 revocation timestamp, when revoked. */
  revokedAt: string | null;

  /** Whether the session is currently active. */
  active: boolean;
}

/**
 * Response body of `GET /api/v1/admin/sessions`.
 */
export class AdminSessionListDto {
  /** Matching sessions, newest first. */
  sessions: AdminSessionDto[];
}
