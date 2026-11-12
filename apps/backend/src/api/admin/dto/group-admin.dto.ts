/**
 * Request/response DTOs for the admin directory group API
 * (`/api/v1/admin/groups`, lldap-backed).
 */

import { IsInt, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateIf } from "class-validator";

/**
 * Payload for `POST /api/v1/admin/groups`.
 */
export class CreateAdminGroupDto {
  /** Group display name. */
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  displayName: string;
}

/**
 * Payload for `PATCH /api/v1/admin/groups/:id`.
 */
export class UpdateAdminGroupDto {
  /** New group display name. */
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  displayName?: string;

  /** Higher values take precedence; tied groups combine permissions. */
  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(1000)
  priority?: number;

  /** Permission bitfield as a decimal string. */
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(32)
  @Matches(/^(0|[1-9]\d*)$/)
  permissions?: string;
}

/**
 * Payload for group membership changes.
 */
export class GroupMemberDto {
  /** lldap uid of the user to add/remove. */
  @IsString()
  @MaxLength(256)
  userId: string;
}

/**
 * A directory group as returned by the admin API.
 */
export class AdminGroupDto {
  /** lldap numeric group id. */
  @IsInt()
  @Min(0)
  id: number;

  /** Group display name. */
  displayName: string;

  /** Ids of member users. */
  members: string[];

  /** Higher values take precedence; tied groups combine permissions. */
  priority: number;

  /** Permission bitfield as a decimal string. */
  permissions: string;

  /** Whether this is the immutable platform admin group. */
  isPlatformAdmin: boolean;
}

/**
 * Response body of `GET /api/v1/admin/groups`.
 */
export class AdminGroupListDto {
  /** All directory groups. */
  groups: AdminGroupDto[];
}
