/**
 * Admin directory group service (lldap-backed).
 */

import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PermissionBitField } from "@inftkr/shared";
import { APP_CONFIG, type AppConfig } from "../../config/config.js";
import { LldapService, LldapWriteError } from "../../lldap/lldap.service.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { AdminGroupDto, UpdateAdminGroupDto } from "./dto/group-admin.dto.js";

@Injectable()
export class AdminGroupsService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly lldap: LldapService,
    private readonly prisma: PrismaService,
  ) {}

  /** Lists all directory groups. */
  async list(): Promise<AdminGroupDto[]> {
    try {
      const [groups, policies] = await Promise.all([
        this.lldap.listGroups(),
        this.prisma.groupPolicy.findMany(),
      ]);
      const byId = new Map(policies.map((policy) => [policy.groupId, policy]));
      return groups.map((group) => ({
        ...group,
        priority: byId.get(group.id)?.priority ?? 0,
        permissions: group.displayName === this.config.lldapAdminGroupName
          ? PermissionBitField.All.toString()
          : byId.get(group.id)?.permissions ?? "0",
        isPlatformAdmin: group.displayName === this.config.lldapAdminGroupName,
      }));
    } catch (error) {
      throw this.toHttp(error);
    }
  }

  /** Creates a directory group and returns it. */
  async create(displayName: string): Promise<AdminGroupDto> {
    this.assertAvailableName(displayName);
    try {
      const id = await this.lldap.createGroupAdmin(displayName);
      return { id, displayName, members: [], priority: 0, permissions: "0", isPlatformAdmin: false };
    } catch (error) {
      throw this.toHttp(error);
    }
  }

  /** Updates a directory group. The platform admin group is immutable. */
  async update(groupId: number, input: UpdateAdminGroupDto, actorPermissions: string): Promise<AdminGroupDto> {
    if (input.displayName === undefined && input.priority === undefined && input.permissions === undefined) {
      throw new BadRequestException("Nothing to update");
    }
    if (input.permissions !== undefined) {
      if (!/^(0|[1-9]\d*)$/.test(input.permissions)) {
        throw new BadRequestException("Invalid permission bits");
      }
      const bits = BigInt(input.permissions);
      if ((bits & ~PermissionBitField.All) !== 0n) {
        throw new BadRequestException("Unknown permission bits");
      }
    }
    if (input.displayName !== undefined) this.assertAvailableName(input.displayName);
    const target = await this.assertNotAdminGroup(groupId);
    if ((input.priority !== undefined || input.permissions !== undefined) &&
        (BigInt(input.permissions ?? target.permissions) & ~BigInt(actorPermissions)) !== 0n) {
      throw new ForbiddenException("Cannot grant permissions you do not hold");
    }
    try {
      if (input.displayName !== undefined) {
        await this.lldap.updateGroupAdmin(groupId, input.displayName);
      }
      if (input.priority !== undefined || input.permissions !== undefined) {
        await this.prisma.groupPolicy.upsert({
          where: { groupId },
          create: {
            groupId,
            priority: input.priority ?? 0,
            permissions: input.permissions ?? "0",
          },
          update: {
            ...(input.priority !== undefined ? { priority: input.priority } : {}),
            ...(input.permissions !== undefined ? { permissions: input.permissions } : {}),
          },
        });
      }
    } catch (error) {
      throw this.toHttp(error);
    }
    const groups = await this.list();
    const updated = groups.find((g) => g.id === groupId);
    if (!updated) throw new NotFoundException(`Unknown group "${groupId}"`);
    return updated;
  }

  /** Deletes a directory group. The platform admin group cannot be deleted. */
  async remove(groupId: number): Promise<void> {
    const target = (await this.list()).find((group) => group.id === groupId);
    if (target?.isPlatformAdmin) {
      throw new BadRequestException("The platform admin group cannot be modified");
    }
    try {
      if (target) await this.lldap.deleteGroupAdmin(groupId);
      await this.prisma.groupPolicy.deleteMany({ where: { groupId } });
    } catch (error) {
      throw this.toHttp(error);
    }
  }

  /** Adds a user to a group. */
  async addMember(groupId: number, userId: string, actorPermissions: string): Promise<void> {
    const target = (await this.list()).find((group) => group.id === groupId);
    if (!target) throw new NotFoundException(`Unknown group "${groupId}"`);
    if ((BigInt(target.permissions) & ~BigInt(actorPermissions)) !== 0n) {
      throw new ForbiddenException("Cannot join users to a group with permissions you do not hold");
    }
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

  private async assertNotAdminGroup(groupId: number): Promise<AdminGroupDto> {
    const groups = await this.list();
    const target = groups.find((g) => g.id === groupId);
    if (target && target.displayName === this.config.lldapAdminGroupName) {
      throw new BadRequestException("The platform admin group cannot be modified");
    }
    if (!target) throw new NotFoundException(`Unknown group "${groupId}"`);
    return target;
  }

  private assertAvailableName(displayName: string): void {
    if (displayName.toLowerCase() === this.config.lldapAdminGroupName.toLowerCase()) {
      throw new BadRequestException("The platform admin group name is reserved");
    }
  }

  private toHttp(error: unknown): Error {
    if (error instanceof BadRequestException || error instanceof NotFoundException) {
      return error;
    }
    if (error instanceof LldapWriteError) {
      return new BadRequestException(error.message);
    }
    throw error;
  }
}
