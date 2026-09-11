/**
 * Self-service account DTOs (`/api/v1/account`).
 */

import { IsEmail, IsIn, IsOptional, IsString, Length, Matches, MaxLength, MinLength } from "class-validator";

/**
 * Payload for `POST /api/v1/account/password`.
 * `currentPassword` may be omitted for social-only accounts with no LDAP
 * password yet (initial set).
 */
export class ChangePasswordDto {
  /** Current password (required when the account has one). */
  @IsOptional()
  @IsString()
  @MaxLength(256)
  currentPassword?: string;

  /** New password. */
  @IsString()
  @MinLength(8)
  @MaxLength(256)
  newPassword: string;
}

/**
 * Payload for `POST /api/v1/account/email/request`.
 */
export class RequestEmailChangeDto {
  /** New email address (also becomes the new lldap uid). */
  @IsEmail()
  @MaxLength(256)
  newEmail: string;
}

/**
 * Payload for `POST /api/v1/account/email/confirm`.
 */
export class ConfirmEmailChangeDto {
  /** Six-digit code from the verification email. */
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  code: string;
}

/**
 * A linked social identity owned by the current user.
 */
export class LinkedSocialAccountDto {
  /** Social provider. */
  @IsIn(["github", "discord"])
  provider: string;

  /** Email reported by the provider. */
  email: string;

  /** ISO 8601 link timestamp. */
  createdAt: string;
}
