/**
 * Admin directory group service (lldap-backed).
 */

import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "../../config/config.js";
import { LldapService, LldapWriteError } from "../../lldap/lldap.service.js";
import { AdminGroupDto } from "./dto/group-admin.dto.js";

@Injectable()
export class AdminGroupsService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly lldap: LldapService,
  ) {}

  /** Lists all directory groups. */
  async list(): Promise<AdminGroupDto[]> {
    try {
      return await this.lldap.listGroups();
    } catch (error) {
      throw this.toHttp(error);
    }
  }

  /** Creates a directory group and returns it. */
  async create(displayName: string): Promise<AdminGroupDto> {
    try {
      const id = await this.lldap.createGroupAdmin(displayName);
      return { id, displayName, members: [] };
    } catch (error) {
      throw this.toHttp(error);
    }
  }

  /** Renames a directory group. The platform admin group cannot be renamed. */
  async update(groupId: number, displayName: string): Promise<AdminGroupDto> {
    await this.assertNotAdminGroup(groupId);
    try {
      await this.lldap.updateGroupAdmin(groupId, displayName);
    } catch (error) {
      throw this.toHttp(error);
    }
    const groups = await this.list();
    return groups.find((g) => g.id === groupId) ?? { id: groupId, displayName, members: [] };
  }

  /** Deletes a directory group. The platform admin group cannot be deleted. */
  async remove(groupId: number): Promise<void> {
    await this.assertNotAdminGroup(groupId);
    try {
      await this.lldap.deleteGroupAdmin(groupId);
    } catch (error) {
      throw this.toHttp(error);
    }
  }

  /** Adds a user to a group. */
  async addMember(groupId: number, userId: string): Promise<void> {
    try {
      await this.lldap.addUserToGroup(userId, groupId);
    } catch (error) {
      throw this.toHttp(error);
    }
  }

  /** Removes a user from a group, guarding the last platform admin. */
  async removeMember(groupId: number, userId: string): Promise<void> {
    const groups = await this.list();
    const target = groups.find((g) => g.id === groupId);
    if (target && target.displayName === this.config.lldapAdminGroupName) {
      if (target.members.length <= 1 && target.members.includes(userId)) {
        throw new BadRequestException("Cannot remove the last platform admin");
      }
    }
    try {
      await this.lldap.removeUserFromGroup(userId, groupId);
    } catch (error) {
      throw this.toHttp(error);
    }
  }

  private async assertNotAdminGroup(groupId: number): Promise<void> {
    const groups = await this.list();
    const target = groups.find((g) => g.id === groupId);
    if (target && target.displayName === this.config.lldapAdminGroupName) {
      throw new BadRequestException("The platform admin group cannot be modified");
    }
  }

  private toHttp(error: unknown): Error {
    if (error instanceof BadRequestException) {
      return error;
    }
    if (error instanceof LldapWriteError) {
      return new BadRequestException(error.message);
    }
    throw error;
  }
}
