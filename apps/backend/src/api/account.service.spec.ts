/**
 * Unit tests for the self-service account service.
 *
 * Focus: the email-domain allow-list gates LDAP features and the target of an
 * email change, but never social sign-up itself.
 */

import { describe, expect, it, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";
import type { Session } from "@inftkr/shared";
import { appConfigFixture } from "../config/app-config.fixture.js";
import { platformSettingsFixture } from "../config/platform-settings.fixture.js";
import { AccountService } from "./account.service.js";

const config = appConfigFixture();

function createSession(email: string): Session {
  return {
    id: "session-1",
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    user: {
      provider: "github",
      userId: email,
      email,
      name: "User",
      roles: ["user"],
      permissions: "0",
    },
  };
}

function createService(rows: Record<string, unknown> = {}) {
  const prisma = {
    account: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
      delete: vi.fn(async () => ({})),
    },
    platformSetting: {
      upsert: vi.fn(async () => ({})),
      findUnique: vi.fn(async () => null),
      update: vi.fn(async () => ({})),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
    session: { updateMany: vi.fn(async () => ({ count: 0 })) },
  };
  const lldap = {
    resolveUidByEmail: vi.fn(async () => null),
    authenticate: vi.fn(async () => ({})),
    setPasswordAsAdmin: vi.fn(async () => undefined),
    changePasswordAsUser: vi.fn(async () => undefined),
  };
  const mail = { send: vi.fn(async () => undefined) };
  const sessionService = { createSession: vi.fn() };

  const service = new AccountService(
    config,
    platformSettingsFixture(config, rows).service,
    prisma as never,
    sessionService as never,
    lldap as never,
    mail as never,
  );

  return { service, prisma, lldap, mail };
}

describe("AccountService.emailDomainPolicy", () => {
  it("reports an allow-listed domain as eligible", async () => {
    const { service } = createService();

    await expect(service.emailDomainPolicy(createSession("user@inft.kr"))).resolves.toEqual({
      email: "user@inft.kr",
      allowedDomains: ["inft.kr"],
      domainAllowed: true,
    });
  });

  it("reports an out-of-policy domain as ineligible, listing what is allowed", async () => {
    const { service } = createService();

    await expect(service.emailDomainPolicy(createSession("user@gmail.com"))).resolves.toEqual({
      email: "user@gmail.com",
      allowedDomains: ["inft.kr"],
      domainAllowed: false,
    });
  });

  it("reports the overridden list, so an admin change is visible immediately", async () => {
    const { service } = createService({
      "auth.allowedDomains": ["gmail.com"],
    });

    await expect(service.emailDomainPolicy(createSession("user@gmail.com"))).resolves.toEqual({
      email: "user@gmail.com",
      allowedDomains: ["gmail.com"],
      domainAllowed: true,
    });
  });
});

describe("AccountService LDAP eligibility", () => {
  it("rejects a password change for an out-of-policy domain", async () => {
    const { service, lldap } = createService();

    await expect(
      service.changePassword(createSession("user@gmail.com"), undefined, "longenough"),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(lldap.setPasswordAsAdmin).not.toHaveBeenCalled();
  });

  it("rejects a password change for an out-of-policy domain before checking the current one", async () => {
    const { service, lldap } = createService();

    await expect(
      service.changePassword(createSession("user@gmail.com"), "oldpassword", "longenough"),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(lldap.authenticate).not.toHaveBeenCalled();
  });

  it("allows a password change for an allow-listed domain", async () => {
    const { service, lldap } = createService();

    await service.changePassword(createSession("user@inft.kr"), undefined, "longenough");

    expect(lldap.setPasswordAsAdmin).toHaveBeenCalledWith("user@inft.kr", "longenough");
  });

  it("honours a stored override over the environment default", async () => {
    const { service, lldap } = createService({
      "auth.allowedDomains": ["gmail.com"],
    });

    await service.changePassword(createSession("user@gmail.com"), undefined, "longenough");

    expect(lldap.setPasswordAsAdmin).toHaveBeenCalledWith("user@gmail.com", "longenough");
  });

  it("revokes eligibility for the environment domain once overridden away", async () => {
    const { service, lldap } = createService({
      "auth.allowedDomains": ["gmail.com"],
    });

    await expect(
      service.changePassword(createSession("user@inft.kr"), undefined, "longenough"),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(lldap.setPasswordAsAdmin).not.toHaveBeenCalled();
  });
});

describe("AccountService.requestEmailChange", () => {
  it("rejects a new address outside the allow-list", async () => {
    const { service, mail } = createService();

    await expect(
      service.requestEmailChange(createSession("user@gmail.com"), "other@gmail.com"),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mail.send).not.toHaveBeenCalled();
  });

  it("accepts moving an out-of-policy account to an allow-listed address", async () => {
    const { service, mail } = createService();

    const result = await service.requestEmailChange(
      createSession("user@gmail.com"),
      "user@inft.kr",
    );

    expect(result).toEqual({ email: "user@inft.kr" });
    expect(mail.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "user@inft.kr" }),
    );
  });

  it("validates the target against the override, not the environment default", async () => {
    const { service, mail } = createService({
      "auth.allowedDomains": ["gmail.com"],
    });

    await expect(
      service.requestEmailChange(createSession("user@gmail.com"), "user@inft.kr"),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mail.send).not.toHaveBeenCalled();
  });
});
