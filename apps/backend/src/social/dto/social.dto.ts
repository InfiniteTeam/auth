/**
 * Request/query DTOs for the social sign-in endpoints. These classes drive
 * OpenAPI schema generation via the `@nestjs/swagger` CLI plugin, so each
 * property carries an English doc comment.
 */

import { IsString, Length, Matches } from "class-validator";

/**
 * Payload for `POST /api/v1/auth/social/verify` — confirm an email with the
 * six-digit code sent to the sign-up email address.
 */
export class SocialVerifyDto {
  /** The pending social `Account` id (a snowflake, e.g. `73123456789`). */
  @IsString()
  @Matches(/^\d{4,32}$/)
  accountId: string;

  /** The six-digit code from the verification email. */
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  code: string;
}

/**
 * Payload for `POST /api/v1/auth/social/verify/resend` — request a fresh
 * verification email.
 */
export class SocialResendDto {
  /** The pending social `Account` id (a snowflake, e.g. `73123456789`). */
  @IsString()
  @Matches(/^\d{4,32}$/)
  accountId: string;
}

/**
 * Query parameters for `GET /api/v1/auth/social/verify/link` — the one-time
 * link embedded in the verification email.
 */
export class SocialLinkQueryDto {
  /** The pending social `Account` id (a snowflake, e.g. `73123456789`). */
  @IsString()
  @Matches(/^\d{4,32}$/)
  accountId: string;

  /** The one-time link token from the verification email. */
  @IsString()
  @Length(32, 64)
  token: string;
}