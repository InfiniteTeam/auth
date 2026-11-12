/**
 * Admin directory user service (lldap-backed, read via GraphQL).
 */

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { LldapService, LldapWriteError } from "../../lldap/lldap.service.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { AdminUserDto } from "./dto/user-admin.dto.js";

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly lldap: LldapService,
    private readonly prisma: PrismaService,
  ) {}

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

  /** Creates a directory user and sets its LDAP password. */
  async create(input: {
    email: string;
    displayName: string;
    password: string;
  }): Promise<AdminUserDto> {
    const email = input.email.toLowerCase();
    try {
      await this.lldap.createUser({
        uid: email,
        email,
        displayName: input.displayName,
      });
      try {
        await this.lldap.setPasswordAsAdmin(email, input.password);
      } catch (error) {
        try {
          await this.lldap.deleteUserAdmin(email);
        } catch {
          throw new LldapWriteError(
            "Password setup failed; the new user may need manual cleanup",
          );
        }
        throw error;
      }
      return this.get(email);
    } catch (error) {
      throw this.toHttp(error);
    }
  }

  /** Updates a directory user's email/displayName. */
  async update(
    id: string,
    input: { email?: string; displayName?: string },
  ): Promise<AdminUserDto> {
    if (input.email === undefined && input.displayName === undefined) {
      throw new BadRequestException("Nothing to update");
    }
    try {
      await this.lldap.updateUserAdmin({ id, ...input });
      if (input.email !== undefined || input.displayName !== undefined) {
        await this.prisma.session.updateMany({
          where: { userId: id },
          data: {
            ...(input.email !== undefined && { email: input.email }),
            ...(input.displayName !== undefined && { name: input.displayName }),
          },
        });
      }
    } catch (error) {
      throw this.toHttp(error);
    }
    return this.get(id);
  }

  /** Deletes a directory user. */
  async remove(id: string): Promise<void> {
    await this.get(id);
    try {
      await this.prisma.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.prisma.account.deleteMany({ where: { userId: id } });
      await this.lldap.deleteUserAdmin(id);
    } catch (error) {
      throw this.toHttp(error);
    }
  }

  private toHttp(error: unknown): Error {
    if (
      error instanceof NotFoundException ||
      error instanceof BadRequestException
    ) {
      return error;
    }
    if (error instanceof LldapWriteError) {
      return new BadRequestException(error.message);
    }
    throw error;
  }
}
