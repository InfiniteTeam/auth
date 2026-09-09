/**
 * Unit tests for SessionService cookie signing/verification and revocation.
 */

import { describe, expect, it, vi } from "vitest";
import { SessionService, SESSION_COOKIE } from "./session.service.js";
import { appConfigFixture } from "../config/app-config.fixture.js";

const config = appConfigFixture();

function createService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    session: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: data.id,
        ...data,
      })),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
  };
  const service = new SessionService(config, prisma as never);
  return { service, prisma };
}

describe("SessionService", () => {
  it("creates a signed cookie value from a session", async () => {
    const { service, prisma } = createService();
    const res = await service.createSession({
      userId: "devuser",
      provider: "ldap",
      email: "devuser@inftkr.kr",
      name: "Dev User",
      roles: ["user"],
      permissions: "0",
    });
    expect(res.cookieValue).toMatch(/^[0-9a-f-]+\.[0-9a-f]{64}$/);
    expect(prisma.session.create).toHaveBeenCalledTimes(1);
    expect(res.session.user.userId).toBe("devuser");
  });

  it("returns null when the cookie is malformed", async () => {
    const { service } = createService();
    await expect(
      service.resolveSessionFromCookie("not-a-cookie"),
    ).resolves.toBeNull();
    await expect(service.resolveSessionFromCookie("abc")).resolves.toBeNull();
    await expect(
      service.resolveSessionFromCookie(undefined),
    ).resolves.toBeNull();
  });

  it("returns null when the cookie signature does not match", async () => {
    const { service } = createService();
    await expect(
      service.resolveSessionFromCookie(
        "02be1aaa-cf8e-4a39-9e99-5df0c1bdfb95.deadbeef",
      ),
    ).resolves.toBeNull();
  });

  it("resolves a session for a valid cookie", async () => {
    const { service, prisma } = createService();
    const { session, cookieValue } = await service.createSession({
      userId: "devuser",
      provider: "ldap",
      email: "devuser@inftkr.kr",
      name: "Dev User",
      roles: ["user"],
      permissions: "0",
    });
    (prisma.session.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: session.id,
      userId: "devuser",
      provider: "ldap",
      email: "devuser@inftkr.kr",
      name: "Dev User",
      roles: ["user"],
      permissions: "0",
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + SESSION_COOKIE.maxAge * 1000),
      revokedAt: null,
    });
    const resolved = await service.resolveSessionFromCookie(cookieValue);
    expect(resolved).not.toBeNull();
    expect(resolved?.user.userId).toBe("devuser");
    expect(resolved?.user.permissions).toBe("0");
  });

  it("returns null for an expired session", async () => {
    const { service, prisma } = createService();
    const { session, cookieValue } = await service.createSession({
      userId: "devuser",
      provider: "ldap",
      email: "devuser@inftkr.kr",
      name: "Dev User",
      roles: ["user"],
      permissions: "0",
    });
    (prisma.session.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: session.id,
      userId: "devuser",
      provider: "ldap",
      email: "devuser@inftkr.kr",
      name: "Dev User",
      roles: ["user"],
      issuedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() - 1000),
      revokedAt: null,
    });
    await expect(
      service.resolveSessionFromCookie(cookieValue),
    ).resolves.toBeNull();
  });

  it("revokes a session for a valid cookie", async () => {
    const { service, prisma } = createService();
    const { cookieValue } = await service.createSession({
      userId: "devuser",
      provider: "ldap",
      email: "devuser@inftkr.kr",
      name: "Dev User",
      roles: ["user"],
      permissions: "0",
    });
    (prisma.session.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({
      count: 1,
    });
    await expect(service.revokeSession(cookieValue)).resolves.toBe(true);
  });
});
