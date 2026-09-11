/**
 * Request/response DTOs for the admin directory user API
 * (`/api/v1/admin/users`, lldap-backed).
 */

import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";
import { Type } from "class-transformer";

/**
 * Query parameters for `GET /api/v1/admin/users`.
 */
export class ListAdminUsersQueryDto {
  /** Case-insensitive substring filter over id/email/displayName. */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  search?: string;

  /** Maximum number of users to return (1-200, defaults to 50). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

/**
 * Payload for `PATCH /api/v1/admin/users/:id`.
 */
export class UpdateAdminUserDto {
  /** New primary email address. */
  @IsOptional()
  @IsEmail()
  @MaxLength(256)
  email?: string;

  /** New display name. */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  displayName?: string;
}

/**
 * A directory user as returned by the admin API.
 */
export class AdminUserDto {
  /** lldap uid. */
  id: string;

  /** Primary email address. */
  email: string;

  /** Display name. */
  displayName: string;

  /** Display names of groups the user belongs to. */
  groups: string[];
}

/**
 * Response body of `GET /api/v1/admin/users`.
 */
export class AdminUserListDto {
  /** Matching directory users. */
  users: AdminUserDto[];
}
