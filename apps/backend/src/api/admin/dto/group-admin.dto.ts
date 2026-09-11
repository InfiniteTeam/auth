/**
 * Request/response DTOs for the admin directory group API
 * (`/api/v1/admin/groups`, lldap-backed).
 */

import { IsInt, IsString, MaxLength, Min } from "class-validator";

/**
 * Payload for `POST /api/v1/admin/groups`.
 */
export class CreateAdminGroupDto {
  /** Group display name. */
  @IsString()
  @MaxLength(64)
  displayName: string;
}

/**
 * Payload for `PATCH /api/v1/admin/groups/:id`.
 */
export class UpdateAdminGroupDto {
  /** New group display name. */
  @IsString()
  @MaxLength(64)
  displayName: string;
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
}

/**
 * Response body of `GET /api/v1/admin/groups`.
 */
export class AdminGroupListDto {
  /** All directory groups. */
  groups: AdminGroupDto[];
}
