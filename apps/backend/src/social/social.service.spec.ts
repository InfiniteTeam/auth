/**
 * Unit tests for the social sign-in service.
 *
 * Focus: social sign-up is deliberately *not* gated on the email domain
 * allow-list. Any verified provider email may register; the list only decides
 * LDAP eligibility later on.
 */

import { describe, expect, it, vi } from "vitest";
import { appConfigFixture } from "../config/app-config.fixture.js";
import { platformSettingsFixture } from "../config/platform-settings.fixture.js";
import { SocialService } from "./social.service.js";
import type { SocialProvider } from "./providers/provider.interface.js";
import type { SocialProfile } from "./social.types.js";

const config = appConfigFixture();

const PROFILE: SocialProfile = {
  providerUserId: "gh-1",
  email: "user@gmail.com",
  name: "User",
};

function createProvider(): SocialProvider {
  return {
    id: "github",
    requiresPkce: false,
    authorizationUrl: vi.fn(async () => "https://example.test/authorize"),
    exchangeCode: vi.fn(async () => ({ accessToken: "t" })),
    fetchProfile: vi.fn(async () => PROFILE),
    assertMembership: vi.fn(async () => undefined),
  };
}

function createService(rows: Record<string, unknown> = {}) {
  const prisma = {
    account: {
      findUnique: vi.fn(async () => null),
      findFirst: vi.fn(async () => null),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => ({
        id: "acc-1",
        ...args.data,
      })),
      update: vi.fn(async () => ({})),
    },
  };
  const lldap = {
    resolveUidByEmail: vi.fn(async () => null),
    createUser: vi.fn(async () => undefined),
    getUserById: vi.fn(async () => null),
  };
  const sessionService = {
    createSession: vi.fn(async () => ({
      session: { id: "s1", user: { id: "user@gmail.com", email: PROFILE.email } },
      cookieValue: "cookie",
    })),
  };
  const verification = {
    send: vi.fn(async () => ({ ok: true, email: PROFILE.email })),
    verifyCode: vi.fn(async () => ({ ok: true })),
    verifyToken: vi.fn(async () => ({ ok: true })),
    isPendingVerification: vi.fn(async () => false),
  };
  const oauthState = {
    create: vi.fn(() => ({ state: "s", codeVerifier: "v" })),
    verify: vi.fn(() => ({ provider: "github", codeVerifier: "v" })),
  };

  const service = new SocialService(
    config,
    platformSettingsFixture(config, rows).service,
    [createProvider()],
    oauthState as never,
    verification as never,
    sessionService as never,
    lldap as never,
    prisma as never,
  );

  return { service, prisma, lldap, sessionService, verification };
}

const CODE_AND_STATE = { code: "code", state: "state" };

describe("SocialService email domain policy", () => {
  it("signs up a provider email outside the allow-list instead of rejecting it", async () => {
    const { service, prisma } = createService();

    const outcome = await service.callback(
      "github",
      CODE_AND_STATE,
      "state-cookie",
      null,
    );

    expect(outcome).toEqual({
      kind: "verification",
      accountId: expect.any(String),
      email: "user@gmail.com",
    });
    expect(prisma.account.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: "user@gmail.com" }),
      }),
    );
  });

  it("signs up an allow-listed provider email as before", async () => {
    const { service } = createService();

    const outcome = await service.callback("github", CODE_AND_STATE, "cookie", null);

    expect(outcome.kind).toBe("verification");
  });

  it("still rejects a provider email that collides with an existing identity", async () => {
    const { service, prisma } = createService();
    prisma.account.findFirst.mockResolvedValue({
      id: "other",
      email: "user@gmail.com",
      verified: true,
    } as never);

    const outcome = await service.callback("github", CODE_AND_STATE, "cookie", null);

    expect(outcome).toEqual({ kind: "error", code: "email_exists" });
  });

  it("finalizes an out-of-policy account, creating its lldap user and session", async () => {
    const { service, prisma, lldap, sessionService } = createService();
    prisma.account.findUnique.mockResolvedValue({
      id: "acc-1",
      userId: "user@gmail.com",
      email: "user@gmail.com",
      name: "User",
      provider: "github",
      verified: true,
    } as never);

    const result = await service.verify("acc-1", "123456");

    expect(result.ok).toBe(true);
    expect(lldap.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ uid: "user@gmail.com" }),
    );
    expect(sessionService.createSession).toHaveBeenCalled();
  });

  it("refuses to finalize an account that was never verified", async () => {
    const { service, prisma } = createService();
    prisma.account.findUnique.mockResolvedValue({
      id: "acc-1",
      userId: "user@gmail.com",
      verified: false,
    } as never);

    const result = await service.verify("acc-1", "123456");

    expect(result).toEqual({ ok: false, reason: "account_not_found" });
  });
});

describe("SocialService.redirectUri", () => {
  it("builds the callback URI from the environment default", async () => {
    const { service } = createService();

    await expect(service.redirectUri("github")).resolves.toBe(
      "http://localhost:3000/api/v1/auth/social/github/callback",
    );
  });

  it("applies a stored redirect base URL override", async () => {
    const { service } = createService({
      "auth.socialRedirectBaseUrl": "https://auth.example.com",
    });

    await expect(service.redirectUri("discord")).resolves.toBe(
      "https://auth.example.com/api/v1/auth/social/discord/callback",
    );
  });
});
