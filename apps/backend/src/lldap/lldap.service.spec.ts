/**
 * Unit tests for lldap group membership -> permission mapping.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PermissionBitField } from "@inftkr/shared";
import { LldapService } from "./lldap.service.js";
import { appConfigFixture } from "../config/app-config.fixture.js";

const config = appConfigFixture();
const prisma = { groupPolicy: { findMany: vi.fn(async () => [] as { priority: number; permissions: string }[]) } };

function okResponse(jsonBody: unknown): Response {
  return { ok: true, json: async () => jsonBody } as unknown as Response;
}

describe("LldapService permissions", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    prisma.groupPolicy.findMany.mockClear();
    prisma.groupPolicy.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("grants every permission to members of the admin group", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(okResponse({ token: "test-jwt" }))
      .mockResolvedValueOnce(
        okResponse({ data: { groups: [
          {
            id: "admins",
            displayName: "admins",
            users: [{ id: "devuser" }],
          },
        ] } }),
      );

    const service = new LldapService(config, prisma as never);
    await expect(service.permissionsFor("devuser")).resolves.toBe(
      PermissionBitField.All.toString(),
    );
  });

  it("grants no permissions to non-members", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(okResponse({ token: "test-jwt" }))
      .mockResolvedValueOnce(
        okResponse({ data: { groups: [
          {
            id: "admins",
            displayName: "admins",
            users: [{ id: "someone-else" }],
          },
        ] } }),
      );

    const service = new LldapService(config, prisma as never);
    await expect(service.permissionsFor("devuser")).resolves.toBe("0");
  });

  it("ignores the admin group when it has no members", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(okResponse({ token: "test-jwt" }))
      .mockResolvedValueOnce(
        okResponse({ data: { groups: [{ id: "admins", displayName: "admins", users: [] }] } }),
      );

    const service = new LldapService(config, prisma as never);
    await expect(service.permissionsFor("devuser")).resolves.toBe("0");
  });

  it("returns no permissions when lldap is unreachable", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockRejectedValueOnce(new Error("connection refused"));

    const service = new LldapService(config, prisma as never);
    await expect(service.permissionsFor("devuser")).resolves.toBe("0");
  });
  it("uses the highest priority policy and combines ties", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(okResponse({ token: "test-jwt" }))
      .mockResolvedValueOnce(okResponse({ data: { groups: [
        { id: 1, displayName: "readers", users: [{ id: "devuser" }] },
        { id: 2, displayName: "editors", users: [{ id: "devuser" }] },
        { id: 3, displayName: "legacy", users: [{ id: "devuser" }] },
      ] } }));
    prisma.groupPolicy.findMany.mockResolvedValue([
      { priority: 5, permissions: "8" },
      { priority: 5, permissions: "16" },
      { priority: 1, permissions: "32" },
    ]);

    const service = new LldapService(config, prisma as never);
    await expect(service.permissionsFor("devuser")).resolves.toBe("24");
    expect(prisma.groupPolicy.findMany).toHaveBeenCalledWith({
      where: { groupId: { in: [1, 2, 3] } },
    });
  });
});

describe("LldapService user DN", () => {
  it("escapes special characters in email-based user ids", () => {
    const service = new LldapService(config, prisma as never) as unknown as { userDn(uid: string): string };
    expect(service.userDn("a+b@example.com")).toBe(`uid=a\\+b@example.com,ou=people,${config.lldapBaseDn}`);
  });
});
