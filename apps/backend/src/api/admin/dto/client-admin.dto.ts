/**
 * Request/response DTOs for the admin OIDC client management API
 * (`/api/v1/admin/clients`).
 */

import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from "class-validator";

/** Grant types supported when issuing an OIDC client. */
const GRANT_TYPES = [
  "authorization_code",
  "refresh_token",
  "implicit",
  "client_credentials",
] as const;

/** Response types supported when issuing an OIDC client. */
const RESPONSE_TYPES = ["code", "id_token", "id_token token"] as const;

/** Token endpoint authentication methods for issued clients. */
const TOKEN_ENDPOINT_AUTH_METHODS = [
  "client_secret_post",
  "client_secret_basic",
  "none",
] as const;

/**
 * Payload for `POST /api/v1/admin/clients` — register a new OIDC client.
 */
export class CreateOidcClientDto {
  /** Human-readable client name shown on the consent screen. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  clientName?: string;

  /** Allowed redirect URIs; at least one is required. */
  @IsArray()
  @ArrayNotEmpty()
  @IsUrl({ require_tld: false }, { each: true })
  redirectUris: string[];

  /** Grant types the client may use (defaults to `authorization_code`). */
  @IsOptional()
  @IsArray()
  @IsIn(GRANT_TYPES, { each: true })
  grantTypes?: string[];

  /** Response types the client may use (defaults to `code`). */
  @IsOptional()
  @IsArray()
  @IsIn(RESPONSE_TYPES, { each: true })
  responseTypes?: string[];

  /** Scopes the client may request (defaults to `openid profile email`). */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];

  /**
   * Token endpoint authentication method
   * (defaults to `client_secret_post`).
   */
  @IsOptional()
  @IsIn(TOKEN_ENDPOINT_AUTH_METHODS)
  tokenEndpointAuthMethod?: string;
}

/**
 * Payload for `PATCH /api/v1/admin/clients/:clientId` — update redirect URIs
 * and display metadata.
 */
export class UpdateOidcClientDto {
  /** Human-readable client name shown on the consent screen. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  clientName?: string;

  /** Allowed redirect URIs; at least one is required when provided. */
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsUrl({ require_tld: false }, { each: true })
  redirectUris?: string[];
}

/**
 * A registered OIDC client as returned by the admin API.
 */
export class OidcClientDto {
  /** The generated Snowflake client identifier. */
  clientId: string;

  /** Human-readable client name. */
  clientName?: string;

  /** Allowed redirect URIs. */
  redirectUris: string[];

  /** Grant types the client may use. */
  grantTypes: string[];

  /** Response types the client may use. */
  responseTypes: string[];

  /** Scopes the client may request. */
  scopes: string[];

  /** Token endpoint authentication method. */
  tokenEndpointAuthMethod: string;

  /** ISO 8601 creation timestamp. */
  createdAt: string;
}

/**
 * Response body of `POST /api/v1/admin/clients`.
 */
export class CreateOidcClientResponseDto extends OidcClientDto {
  /**
   * The client secret. Returned exactly once; subsequent reads of the client
   * do not re-expose it (the value is stored in plain text for the token
   * endpoint comparison).
   */
  clientSecret: string;
}

/**
 * Response body of `GET /api/v1/admin/clients`.
 */
export class OidcClientListDto {
  /** Registered OIDC clients. */
  clients: OidcClientDto[];

  /** Arbitrary metadata (reserved for future pagination). */
  @IsObject()
  @IsOptional()
  meta?: Record<string, never>;
}