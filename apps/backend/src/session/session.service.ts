/**
 * Session service: creates, validates, refreshes and revokes sessions stored
 * in the Prisma `auth` database.
 *
 * The `inft_session` cookie carries only the session id and an HMAC signature
 * (`<id>.<signature>`); all profile data lives server-side so it can be
 * revoked instantly.
 */

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { AuthProvider, Role, Session, SessionUser } from "@inft/shared";
import { SESSION_COOKIE_NAME } from "@inft/shared";
import { PrismaService } from "../prisma/prisma.service.js";
import { APP_CONFIG, type AppConfig } from "../config/config.js";

/** HTTP-only, secure, lax session cookie configuration. */
export const SESSION_COOKIE = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7, // 7 days, matches SESSION_COOKIE_OPTIONS in @inft/shared
};

/**
 * Payload used to mint a {@link Session}.
 */
export interface CreateSessionInput {
  /** Unique user identifier (ldap uid). */
  userId: string;
  /** Authentication provider used to sign in. */
  provider: AuthProvider;
  /** Primary email address. */
  email: string;
  /** Display name. */
  name: string;
  /** Roles assigned to the user. */
  roles: Role[];
  /** Session lifetime in seconds (default 7 days). */
  ttlSeconds?: number;
}

@Injectable()
export class SessionService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Computes the HMAC signature of a session id.
   */
  private sign(id: string): string {
    return createHmac("sha256", this.config.sessionSecret)
      .update(id)
      .digest("hex");
  }

  /**
   * Parses a raw cookie value into its session id, verifying the attached HMAC
   * signature. Returns `null` for a malformed or tampered value.
   */
  private parseCookie(rawCookie: string): string | null {
    const dot = rawCookie.lastIndexOf(".");
    if (dot <= 0 || dot >= rawCookie.length - 1) {
      return null;
    }
    const id = rawCookie.slice(0, dot);
    const signature = rawCookie.slice(dot + 1);
    const expected = this.sign(id);
    const expectedBuf = Buffer.from(expected, "utf8");
    const signatureBuf = Buffer.from(signature, "utf8");
    if (expectedBuf.length !== signatureBuf.length) {
      return null;
    }
    return timingSafeEqual(expectedBuf, signatureBuf) ? id : null;
  }

  /**
   * Creates a session row, mints the signed cookie value and returns both the
   * session and the cookie string to set.
   */
  async createSession(
    input: CreateSessionInput,
  ): Promise<{ session: Session; cookieValue: string }> {
    const ttlMs = (input.ttlSeconds ?? SESSION_COOKIE.maxAge) * 1000;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);

    const id = randomUUID();
    const row = await this.prisma.session.create({
      data: {
        id,
        userId: input.userId,
        provider: input.provider,
        email: input.email,
        name: input.name,
        roles: input.roles,
        issuedAt: now,
        expiresAt,
      },
    });

    const cookieValue = `${row.id}.${this.sign(row.id)}`;
    return { session: this.toSession(row), cookieValue };
  }

  /**
   * Resolves the current session from a raw cookie value, verifying its
   * signature and checking it is not expired or revoked. Returns `null` when
   * invalid.
   */
  async resolveSessionFromCookie(
    rawCookie: string | undefined | null,
  ): Promise<Session | null> {
    if (!rawCookie) {
      return null;
    }

    const id = this.parseCookie(rawCookie);
    if (!id) {
      return null;
    }

    const row = await this.prisma.session.findUnique({
      where: { id },
    });
    if (!row || row.revokedAt || row.expiresAt.getTime() < Date.now()) {
      return null;
    }

    return this.toSession(row);
  }

  /**
   * Revokes a session and returns `true` when a row was revoked.
   */
  async revokeSession(rawCookie: string | undefined | null): Promise<boolean> {
    if (!rawCookie) {
      return false;
    }

    const id = this.parseCookie(rawCookie);
    if (!id) {
      return false;
    }

    const result = await this.prisma.session.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count > 0;
  }

  private toSession(row: {
    id: string;
    userId: string;
    provider: string;
    email: string;
    name: string;
    roles: string[];
    issuedAt: Date;
    expiresAt: Date;
  }): Session {
    const user: SessionUser = {
      provider: row.provider as AuthProvider,
      userId: row.userId,
      email: row.email,
      name: row.name,
      roles: row.roles as Role[],
    };
    return {
      id: row.id,
      user,
      issuedAt: row.issuedAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
    };
  }
}

/** The name of the session cookie, re-exported for convenience. */
export { SESSION_COOKIE_NAME };
