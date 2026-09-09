/**
 * Unit tests for lldap group membership -> permission mapping.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PermissionBitField } from "@inftkr/shared";
import { LldapService } from "./lldap.service.js";
import type { AppConfig } from "../config/config.js";

const config: AppConfig = {
  port: 3000,
  nodeEnv: "test",
  issuerUrl: "http://localhost:3000",
  sessionSecret: "test-session-secret",
  jwksPath: "./jwks.json",
  tailscaleClientSecret: "test-client-secret",
  databaseUrl: "postgresql://auth:auth@localhost:5432/auth",
  lldapUrl: "http://localhost:17170",
  lldapAdminDn: "admin",
  lldapAdminPassword: "test",
  lldapAdminGroupName: "admins",
  snowflakeWorkerId: 0,
  snowflakeEpochMs: Date.UTC(2026, 8, 8),
};

function okResponse(jsonBody: unknown): Response {
  return { ok: true, json: async () => jsonBody } as unknown as Response;
}

describe("LldapService permissions", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
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

    const service = new LldapService(config);
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

    const service = new LldapService(config);
    await expect(service.permissionsFor("devuser")).resolves.toBe("0");
  });

  it("ignores the admin group when it has no members", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(okResponse({ token: "test-jwt" }))
      .mockResolvedValueOnce(
        okResponse({ data: { groups: [{ id: "admins", displayName: "admins", users: [] }] } }),
      );

    const service = new LldapService(config);
    await expect(service.permissionsFor("devuser")).resolves.toBe("0");
  });

  it("returns no permissions when lldap is unreachable", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockRejectedValueOnce(new Error("connection refused"));

    const service = new LldapService(config);
    await expect(service.permissionsFor("devuser")).resolves.toBe("0");
  });
});