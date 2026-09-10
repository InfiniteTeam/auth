/**
 * Unit tests for VerificationService code/token generation, hashing, TTLs and
 * attempt limits.
 */

import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { appConfigFixture } from "../config/app-config.fixture.js";
import { MailService } from "./mail.service.js";
import { VerificationService } from "./verification.service.js";
import type { SocialProviderId } from "./social.types.js";

const config = appConfigFixture();

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

type AccountRecord = {
  id: string;
  provider: SocialProviderId;
  email: string;
  verified: boolean;
  verifiedAt: Date | null;
  verificationCodeHash: string | null;
  verificationCodeExpires: Date | null;
  verificationTokenHash: string | null;
  verificationTokenExpires: Date | null;
  verificationAttempts: number;
  createdAt: Date;
};

function makeAccount(overrides: Partial<AccountRecord> = {}): AccountRecord {
  return {
    id: "1700000000000000",
    provider: "github",
    email: "user@example.com",
    verified: false,
    verifiedAt: null,
    verificationCodeHash: null,
    verificationCodeExpires: null,
    verificationTokenHash: null,
    verificationTokenExpires: null,
    verificationAttempts: 0,
    createdAt: new Date(),
    ...overrides,
  };
}

function createHarness(account: AccountRecord = makeAccount()) {
  const store = { account };
  const prisma = {
    account: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        store.account && store.account.id === where.id ? store.account : null,
      ),
      update: vi.fn(
        async ({ where, data }: { where: { id: string }; data: Partial<AccountRecord> }) => {
          if (!store.account || store.account.id !== where.id) {
            throw new Error("account not found");
          }
          store.account = { ...store.account, ...data };
          return store.account;
        },
      ),
    },
    session: {},
  };
  const mail = {
    sendVerificationEmail: vi.fn(async () => {
      /* no-op */
    }),
  } as unknown as MailService;
  const service = new VerificationService(
    config,
    prisma as never,
    mail as never,
  );
  return { service, store, prisma, mail };
}

describe("VerificationService.send", () => {
  it("sends a six-digit code and stores hashes with expiry", async () => {
    const { service, store, mail } = createHarness();
    const result = await service.send(store.account.id);
    expect(result).toEqual({ ok: true, email: "user@example.com" });
    expect(mail.sendVerificationEmail).toHaveBeenCalledTimes(1);
    const input = vi.mocked(mail.sendVerificationEmail).mock.calls[0]![0]!;
    const { to, code, link } = input;
    expect(to).toBe("user@example.com");
    expect(code).toMatch(/^\d{6}$/);
    expect(link).toContain(`accountId=${encodeURIComponent(store.account.id)}`);
    expect(link).toMatch(/token=[0-9a-f]{48}/);
    expect(store.account.verificationCodeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(store.account.verificationCodeExpires).toBeInstanceOf(Date);
    expect(store.account.verificationTokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(store.account.verificationTokenExpires).toBeInstanceOf(Date);
    expect(store.account.verificationAttempts).toBe(0);
  });

  it("fails for an unknown account", async () => {
    const { service, mail } = createHarness();
    await expect(service.send("missing")).resolves.toEqual({
      ok: false,
      reason: "account_not_found",
    });
    expect(mail.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("fails for an already verified account", async () => {
    const { service, mail } = createHarness(makeAccount({ verified: true }));
    await expect(service.send(makeAccount().id)).resolves.toEqual({
      ok: false,
      reason: "already_verified",
    });
    expect(mail.sendVerificationEmail).not.toHaveBeenCalled();
  });
});

describe("VerificationService.verifyCode", () => {
  it("verifies an account with the correct code", async () => {
    const account = makeAccount({
      verificationCodeHash: sha256("123456"),
      verificationCodeExpires: new Date(Date.now() + 60_000),
    });
    const { service, store } = createHarness(account);
    const result = await service.verifyCode(account.id, "123456");
    expect(result).toEqual({ ok: true, accountId: account.id });
    expect(store.account.verified).toBe(true);
    expect(store.account.verificationAttempts).toBe(0);
    expect(store.account.verificationCodeHash).toBeNull();
  });

  it("rejects a wrong code and counts the attempt", async () => {
    const account = makeAccount({
      verificationCodeHash: sha256("000000"),
      verificationCodeExpires: new Date(Date.now() + 60_000),
    });
    const { service, store } = createHarness(account);
    const result = await service.verifyCode(account.id, "111111");
    expect(result).toEqual({ ok: false, reason: "invalid_code" });
    expect(store.account.verificationAttempts).toBe(1);
    expect(store.account.verified).toBe(false);
  });

  it("resets the code once the attempt limit is exceeded", async () => {
    const account = makeAccount({
      verificationCodeHash: sha256("000000"),
      verificationCodeExpires: new Date(Date.now() + 60_000),
      verificationAttempts: config.verificationMaxAttempts - 1,
    });
    const { service, store } = createHarness(account);
    const result = await service.verifyCode(account.id, "111111");
    expect(result).toEqual({ ok: false, reason: "code_attempts_exceeded" });
    expect(store.account.verificationCodeHash).toBeNull();
    expect(store.account.verificationCodeExpires).toBeNull();
    expect(store.account.verificationAttempts).toBe(0);
  });

  it("rejects an expired code", async () => {
    const account = makeAccount({
      verificationCodeHash: sha256("123456"),
      verificationCodeExpires: new Date(Date.now() - 1000),
    });
    const { service } = createHarness(account);
    const result = await service.verifyCode(account.id, "123456");
    expect(result).toEqual({ ok: false, reason: "code_expired" });
  });

  it("refuses already verified accounts", async () => {
    const account = makeAccount({ verified: true });
    const { service } = createHarness(account);
    const result = await service.verifyCode(account.id, "123456");
    expect(result).toEqual({ ok: false, reason: "account_not_found" });
  });

  it("fails for an unknown account", async () => {
    const { service } = createHarness();
    const result = await service.verifyCode("missing", "123456");
    expect(result).toEqual({ ok: false, reason: "account_not_found" });
  });
});

describe("VerificationService.verifyToken", () => {
  it("verifies an account with the correct link token", async () => {
    const account = makeAccount({
      verificationTokenHash: sha256("token-value"),
      verificationTokenExpires: new Date(Date.now() + 60_000),
    });
    const { service, store } = createHarness(account);
    const result = await service.verifyToken(account.id, "token-value");
    expect(result).toEqual({ ok: true, accountId: account.id });
    expect(store.account.verified).toBe(true);
  });

  it("rejects a wrong link token", async () => {
    const account = makeAccount({
      verificationTokenHash: sha256("token-value"),
      verificationTokenExpires: new Date(Date.now() + 60_000),
    });
    const { service } = createHarness(account);
    const result = await service.verifyToken(account.id, "attacker-token");
    expect(result).toEqual({ ok: false, reason: "invalid_token" });
  });

  it("rejects an expired link token", async () => {
    const account = makeAccount({
      verificationTokenHash: sha256("token-value"),
      verificationTokenExpires: new Date(Date.now() - 1000),
    });
    const { service } = createHarness(account);
    const result = await service.verifyToken(account.id, "token-value");
    expect(result).toEqual({ ok: false, reason: "token_expired" });
  });
});

describe("VerificationService.isPendingVerification", () => {
  it("is true for an unverified account of the same provider", async () => {
    const { service, store } = createHarness();
    await expect(
      service.isPendingVerification(store.account.id, "github"),
    ).resolves.toBe(true);
  });

  it("is false when the provider does not match", async () => {
    const { service, store } = createHarness();
    await expect(
      service.isPendingVerification(store.account.id, "discord"),
    ).resolves.toBe(false);
  });

  it("is false once the account is verified", async () => {
    const { service, store } = createHarness(makeAccount({ verified: true }));
    await expect(
      service.isPendingVerification(store.account.id, "github"),
    ).resolves.toBe(false);
  });
});