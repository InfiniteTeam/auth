/**
 * Admin session service (Prisma-backed).
 */

import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import { AdminSessionDto } from "./dto/session-admin.dto.js";

@Injectable()
export class AdminSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lists sessions, newest first, with optional owner/active filters. */
  async list(options: { userId?: string; activeOnly?: boolean; limit?: number }): Promise<AdminSessionDto[]> {
    const limit = Math.max(1, Math.min(options.limit ?? 50, 200));
    const rows = await this.prisma.session.findMany({
      where: { ...(options.userId ? { userId: options.userId } : {}) },
      orderBy: { issuedAt: "desc" },
      take: options.activeOnly === false ? limit : limit * 2,
    });
    const now = Date.now();
    const mapped = rows.map((row) => this.toDto(row));
    const filtered = options.activeOnly === false ? mapped : mapped.filter((s) => s.active);
    void now;
    return filtered.slice(0, limit);
  }

  /** Revokes a session by id. Returns true when a row was revoked. */
  async revoke(id: string): Promise<boolean> {
    const result = await this.prisma.session.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count > 0;
  }

  private toDto(row: {
    id: string;
    userId: string;
    email: string;
    provider: string;
    issuedAt: Date;
    expiresAt: Date;
    revokedAt: Date | null;
  }): AdminSessionDto {
    const active = !row.revokedAt && row.expiresAt.getTime() > Date.now();
    return {
      id: row.id,
      userId: row.userId,
      email: row.email,
      provider: row.provider,
      issuedAt: row.issuedAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
      active,
    };
  }
}
