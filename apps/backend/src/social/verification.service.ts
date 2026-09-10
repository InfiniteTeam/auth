/**
 * Verification service — email verification for social sign-up accounts.
 *
 * A fresh social account is created `verified: false`; the user must confirm
 * ownership of the reported email either with a six-digit code or a one-time
 * link before the account can sign in. Only SHA-256 hashes of the secret
 * values are stored.
 */

import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "../config/config.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { MailService } from "./mail.service.js";
import type {
  SocialProviderId,
  SocialVerifyResult,
} from "./social.types.js";

/** Result of (re)sending the verification email. */
export type VerificationSendResult =
  | { ok: true; email: string }
  | {
      ok: false;
      reason: "account_not_found" | "already_verified" | "mail_failed";
    };

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /**
   * Generates a fresh code + link for an account and emails it. The account
   * must exist and must not be verified yet.
   */
  async send(accountId: string): Promise<VerificationSendResult> {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });
    if (!account) {
      return { ok: false, reason: "account_not_found" };
    }
    if (account.verified) {
      return { ok: false, reason: "already_verified" };
    }

    const now = Date.now();
    const code = this.generateCode();
    const token = randomBytes(24).toString("hex");
    await this.prisma.account.update({
      where: { id: accountId },
      data: {
        verificationCodeHash: this.sha256(code),
        verificationCodeExpires: new Date(
          now + this.config.verificationCodeTtlMs,
        ),
        verificationTokenHash: this.sha256(token),
        verificationTokenExpires: new Date(
          now + this.config.verificationTokenTtlMs,
        ),
        verificationAttempts: 0,
      },
    });

    const link = `${this.config.socialRedirectBaseUrl}/api/v1/auth/social/verify/link?accountId=${encodeURIComponent(accountId)}&token=${token}`;
    try {
      await this.mail.sendVerificationEmail({ to: account.email, code, link });
    } catch (error) {
      this.logger.error(
        `Failed to deliver verification email for account ${accountId}: ${this.errorMessage(error)}`,
      );
      return { ok: false, reason: "mail_failed" };
    }
    return { ok: true, email: account.email };
  }

  /**
   * Verifies an account with the emailed six-digit code. Bounded by
   * `verificationMaxAttempts`; exceeding the bound resets the code so a fresh
   * one must be requested.
   */
  async verifyCode(accountId: string, code: string): Promise<SocialVerifyResult> {
    const account = await this.accountForVerification(accountId);
    if (!account) {
      return { ok: false, reason: "account_not_found" };
    }
    const now = Date.now();
    if (
      !account.verificationCodeHash ||
      !account.verificationCodeExpires ||
      account.verificationCodeExpires.getTime() < now
    ) {
      return { ok: false, reason: "code_expired" };
    }
    if (!this.constantTimeEqual(account.verificationCodeHash, this.sha256(code))) {
      const attempts = account.verificationAttempts + 1;
      if (attempts >= this.config.verificationMaxAttempts) {
        await this.prisma.account.update({
          where: { id: accountId },
          data: {
            verificationCodeHash: null,
            verificationCodeExpires: null,
            verificationAttempts: 0,
          },
        });
        return { ok: false, reason: "code_attempts_exceeded" };
      }
      await this.prisma.account.update({
        where: { id: accountId },
        data: { verificationAttempts: attempts },
      });
      return { ok: false, reason: "invalid_code" };
    }
    await this.markVerified(accountId);
    return { ok: true, accountId };
  }

  /**
   * Verifies an account with the one-time link token embedded in the email.
   */
  async verifyToken(accountId: string, token: string): Promise<SocialVerifyResult> {
    const account = await this.accountForVerification(accountId);
    if (!account) {
      return { ok: false, reason: "account_not_found" };
    }
    const now = Date.now();
    if (
      !account.verificationTokenHash ||
      !account.verificationTokenExpires ||
      account.verificationTokenExpires.getTime() < now
    ) {
      return { ok: false, reason: "token_expired" };
    }
    if (!this.constantTimeEqual(account.verificationTokenHash, this.sha256(token))) {
      return { ok: false, reason: "invalid_token" };
    }
    await this.markVerified(accountId);
    return { ok: true, accountId };
  }

  /** Whether the account exists and is awaiting verification. */
  async isPendingVerification(
    accountId: string,
    provider: SocialProviderId,
  ): Promise<boolean> {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });
    return Boolean(
      account && account.provider === provider && !account.verified,
    );
  }

  private async accountForVerification(accountId: string) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });
    return account?.verified ? null : account;
  }

  private async markVerified(accountId: string): Promise<void> {
    await this.prisma.account.update({
      where: { id: accountId },
      data: {
        verified: true,
        verifiedAt: new Date(),
        verificationCodeHash: null,
        verificationCodeExpires: null,
        verificationTokenHash: null,
        verificationTokenExpires: null,
        verificationAttempts: 0,
      },
    });
  }

  private generateCode(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, "0");
  }

  private sha256(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private constantTimeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    const aBuf = Buffer.from(a, "utf8");
    const bBuf = Buffer.from(b, "utf8");
    return timingSafeEqual(aBuf, bBuf);
  }
}