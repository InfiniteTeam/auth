/**
 * Request/response DTOs for the versioned REST API.
 *
 * These classes drive the OpenAPI schema generation via the `@nestjs/swagger`
 * CLI plugin (introspectComments), so each property carries an English doc
 * comment that becomes its description.
 */

import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

/**
 * Payload for `POST /api/v1/auth/ldap` — LDAP sign-in with email + password.
 */
export class LdapLoginDto {
  /** The user's email address (also their lldap uid). */
  @IsEmail()
  email: string;

  /** The plain-text password. Never logged or stored by the backend. */
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  @IsNotEmpty()
  password: string;
}

/**
 * Query parameters for `POST /api/v1/auth/social/:provider`.
 *
 * @remarks Social sign-in is introduced in a follow-up; this DTO validates the
 * provider segment.
 */
export class SocialLoginParams {
  /** The social identity provider to sign in with. */
  @IsIn(["github", "discord"])
  provider: "github" | "discord";
}

/**
 * The session cookie name, surfaced in the OpenAPI document where relevant.
 */
export const SESSION_COOKIE_PARAM = "inft_session";
