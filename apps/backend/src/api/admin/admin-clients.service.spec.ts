/**
 * Unit tests for the admin OIDC client management service.
 */

import { describe, expect, it, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { SnowflakeGenerator } from "../../common/snowflake.js";
import { TAILSCALE_CLIENT_ID } from "../../oidc/provider.factory.js";
import { AdminClientsService } from "./admin-clients.service.js";
import { appConfigFixture } from "../../config/app-config.fixture.js";

const config = appConfigFixture();

function createService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    oidcClient: {
      findMany: vi.fn(async () => []),
      create: vi.fn(),
      delete: vi.fn(async () => ({})),
    },
  };
  const service = new AdminClientsService(
    config,
    { oidcClient: prisma.oidcClient } as never,
    new SnowflakeGenerator({
      workerId: config.snowflakeWorkerId,
      epoch: config.snowflakeEpochMs,
    }),
  );
  return { service, prisma, ...overrides };
}

describe("AdminClientsService", () => {
  it("issues a new client with a Snowflake id and one-time secret", async () => {
    const { service, prisma } = createService();
    const row = {
      clientId: "123456789012345678",
      clientSecret: "abcDEF123-_xyzABCXYZ-0aA0aA0aA0aA0aA0aA",
      grantTypes: ["authorization_code"],
      responseTypes: ["code"],
      redirectUris: ["https://login.tailscale.com/a/oauth_response"],
      scopes: ["openid", "profile", "email"],
      metadata: {
        client_id: "123456789012345678",
        client_secret: "abcDEF123-_xyzABCXYZ-0aA0aA0aA0aA0aA0aA",
        client_secret_expires_at: 0,
        client_name: "Tailscale",
        redirect_uris: ["https://login.tailscale.com/a/oauth_response"],
        grant_types: ["authorization_code"],
        response_types: ["code"],
        scope: "openid profile email",
        token_endpoint_auth_method: "client_secret_post",
      },
      createdAt: new Date(),
    };
    (prisma.oidcClient.create as ReturnType<typeof vi.fn>).mockResolvedValue(
      row,
    );

    const result = await service.create({
      clientName: "Tailscale",
      redirectUris: ["https://login.tailscale.com/a/oauth_response"],
    });

    expect(result.clientId).toMatch(/^\d{17,19}$/);
    expect(result.clientSecret).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.clientName).toBe("Tailscale");
    expect(result.tokenEndpointAuthMethod).toBe("client_secret_post");
    expect(prisma.oidcClient.create).toHaveBeenCalledTimes(1);
    const createCall = (prisma.oidcClient.create as ReturnType<typeof vi.fn>).mock
      .calls[0]![0] as { data: { metadata: Record<string, unknown> } };
    expect(createCall.data.metadata.client_secret_expires_at).toBe(0);
    expect(createCall.data.metadata.scope).toBe("openid profile email");
    expect(createCall.data.metadata.client_id).toMatch(/^\d+$/);
  });

  it("applies defaults for omitted registration fields", async () => {
    const { service, prisma } = createService();
    (prisma.oidcClient.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      clientId: "1",
      clientSecret: "secret",
      grantTypes: ["authorization_code"],
      responseTypes: ["code"],
      redirectUris: ["https://example.com/cb"],
      scopes: ["openid", "profile", "email"],
      metadata: {},
      createdAt: new Date(),
    });

    const result = await service.create({
      redirectUris: ["https://example.com/cb"],
    });
    expect(result.grantTypes).toEqual(["authorization_code"]);
    expect(result.responseTypes).toEqual(["code"]);
    expect(result.scopes).toEqual(["openid", "profile", "email"]);
  });

  it("refuses to delete the built-in Tailscale client", async () => {
    const { service } = createService();
    await expect(service.remove(TAILSCALE_CLIENT_ID)).rejects.toThrow(
      BadRequestException,
    );
  });

  it("deletes a user-issued client", async () => {
    const { service, prisma } = createService();
    await expect(service.remove("123")).resolves.toBeUndefined();
    expect(prisma.oidcClient.delete).toHaveBeenCalledWith({
      where: { clientId: "123" },
    });
  });

  it("lists clients newest first without secrets", async () => {
    const { service, prisma } = createService();
    (prisma.oidcClient.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        clientId: "1",
        clientSecret: "the-secret",
        grantTypes: ["authorization_code"],
        responseTypes: ["code"],
        redirectUris: ["https://example.com/cb"],
        scopes: ["openid"],
        metadata: { token_endpoint_auth_method: "client_secret_basic" },
        createdAt: new Date(),
      },
    ]);
    const clients = await service.list();
    expect(clients).toHaveLength(1);
    expect(clients[0]!.clientId).toBe("1");
    expect(clients[0]!.tokenEndpointAuthMethod).toBe("client_secret_basic");
    expect(clients[0]).not.toHaveProperty("clientSecret");
  });
});