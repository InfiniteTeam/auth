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
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
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
      redirectUris: [
        "https://app.example.com/callback",
        "https://admin.example.com/callback",
      ],
      scopes: ["openid", "profile", "email"],
      metadata: {
        client_id: "123456789012345678",
        client_secret: "abcDEF123-_xyzABCXYZ-0aA0aA0aA0aA0aA0aA",
        client_secret_expires_at: 0,
        client_name: "Example",
        redirect_uris: [
          "https://app.example.com/callback",
          "https://admin.example.com/callback",
        ],
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
      clientName: "Example",
      redirectUris: [
        "https://app.example.com/callback",
        "https://admin.example.com/callback",
      ],
    });

    expect(result.clientId).toMatch(/^\d{17,19}$/);
    expect(result.clientSecret).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.clientName).toBe("Example");
    expect(result.tokenEndpointAuthMethod).toBe("client_secret_post");
    expect(prisma.oidcClient.create).toHaveBeenCalledTimes(1);
    const createCall = (prisma.oidcClient.create as ReturnType<typeof vi.fn>)
      .mock.calls[0]![0] as { data: { metadata: Record<string, unknown> } };
    expect(createCall.data.metadata.client_secret_expires_at).toBe(0);
    expect(createCall.data.metadata.scope).toBe("openid profile email");
    expect(createCall.data.metadata.client_id).toMatch(/^\d+$/);
    expect(createCall.data.metadata.redirect_uris).toEqual(row.redirectUris);
    expect(result.redirectUris).toEqual(row.redirectUris);
  });

  it("updates all redirect URIs in both client metadata and the database column", async () => {
    const { service, prisma } = createService();
    const redirectUris = [
      "https://app.example.com/callback",
      "https://admin.example.com/callback",
    ];
    const row = {
      clientId: "1",
      clientSecret: "secret",
      grantTypes: ["authorization_code"],
      responseTypes: ["code"],
      redirectUris,
      scopes: ["openid"],
      metadata: { client_name: "Example", redirect_uris: redirectUris },
      createdAt: new Date(),
    };
    prisma.oidcClient.findUnique.mockResolvedValue({
      ...row,
      redirectUris: ["https://old.example.com/callback"],
      metadata: {
        client_name: "Example",
        redirect_uris: ["https://old.example.com/callback"],
      },
    });
    prisma.oidcClient.update.mockResolvedValue(row);

    const result = await service.update("1", { redirectUris });

    expect(prisma.oidcClient.update).toHaveBeenCalledWith({
      where: { clientId: "1" },
      data: {
        redirectUris,
        metadata: { client_name: "Example", redirect_uris: redirectUris },
      },
    });
    expect(result.redirectUris).toEqual(redirectUris);
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
