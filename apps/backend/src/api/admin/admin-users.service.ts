/**
 * Admin directory user service (lldap-backed, read via GraphQL).
 */

import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { LldapService, LldapWriteError } from "../../lldap/lldap.service.js";
import { AdminUserDto } from "./dto/user-admin.dto.js";

@Injectable()
export class AdminUsersService {
  constructor(private readonly lldap: LldapService) {}

  /** Lists directory users with optional search. */
  async list(search?: string, limit = 50): Promise<AdminUserDto[]> {
    try {
      const users = await this.lldap.listUsers(search, limit);
      return users.map((u) => ({ ...u }));
    } catch (error) {
      throw this.toHttp(error);
    }
  }

  /** Returns a single directory user by id. */
  async get(id: string): Promise<AdminUserDto> {
    const users = await this.list(id, 200);
    const exact = users.find((u) => u.id === id);
    if (!exact) {
      throw new NotFoundException(`Unknown user "${id}"`);
    }
    return exact;
  }

  /** Updates a directory user's email/displayName. */
  async update(id: string, input: { email?: string; displayName?: string }): Promise<AdminUserDto> {
    if (input.email === undefined && input.displayName === undefined) {
      throw new BadRequestException("Nothing to update");
    }
    try {
      await this.lldap.updateUserAdmin({ id, ...input });
    } catch (error) {
      throw this.toHttp(error);
    }
    return this.get(id);
  }

  /** Deletes a directory user. */
  async remove(id: string): Promise<void> {
    try {
      await this.lldap.deleteUserAdmin(id);
    } catch (error) {
      throw this.toHttp(error);
    }
  }

  private toHttp(error: unknown): Error {
    if (error instanceof NotFoundException || error instanceof BadRequestException) {
      return error;
    }
    if (error instanceof LldapWriteError) {
      return new BadRequestException(error.message);
    }
    throw error;
  }
}
