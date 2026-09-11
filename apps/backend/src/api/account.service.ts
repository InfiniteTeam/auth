/**
 * Self-service account service — password change, social unlink and email
 * change for the authenticated user.
 *
 * Identity lives in lldap (via LDAP/GraphQL); email verification reuses the
 * SMTP mailer. Pending email changes are stored in `PlatformSetting` rows
 * (`email-change.<userId>`) so no schema migration is required.
 */

import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import type { Session } from "@inftkr/shared";
import { APP_CONFIG, type AppConfig } from "../config/config.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { SessionService } from "../session/session.service.js";
import { LldapAuthenticationError, LldapService } from "../lldap/lldap.service.js";
import { MailService } from "../social/mail.service.js";
import { isEmailDomainAllowed } from "../social/domain.util.js";

interface EmailChangePending {
  newEmail: string;
  codeHash: string;
  expiresAt: string;
  attempts: number;
}

const EMAIL_CHANGE_TTL_MS = 10 * 60 * 1000;
const EMAIL_CHANGE_MAX_ATTEMPTS = 5;

@Injectable()
export class AccountService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
    private readonly lldap: LldapService,
    private readonly mail: MailService,
  ) {}

  /** Lists the current user's linked social identities. */
  async linkedSocialAccounts(userId: string) {
    const rows = await this.prisma.account.findMany({
      where: { userId, verified: true },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((r) => ({
      provider: r.provider,
      email: r.email,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /**
   * Unlinks a social identity. Refuses to remove the last sign-in method:
   * at least one verified link must remain, or the session must be LDAP-based
   * (proving an LDAP password exists).
   */
  async unlinkSocial(session: Session, provider: string) {
    if (provider !== "github" && provider !== "discord") {
      throw new BadRequestException("Unknown provider");
    }
    const rows = await this.prisma.account.findMany({
      where: { userId: session.user.userId, verified: true },
    });
    const target = rows.find((r) => r.provider === provider);
    if (!target) {
      throw new NotFoundException("Social identity is not linked");
    }
    const othersRemain = rows.some((r) => r.provider !== provider);
    if (!othersRemain && session.user.provider !== "ldap") {
      throw new BadRequestException(
        "Cannot unlink the last sign-in method. Set a password first.",
      );
    }
    await this.prisma.account.delete({ where: { id: target.id } });
  }

  /**
   * Changes the current user's LDAP password. When `currentPassword` is
   * omitted, an initial password is set (social-only accounts) via the
   * service-account admin bind.
   */
  async changePassword(session: Session, currentPassword: string | undefined, newPassword: string) {
    const uid = session.user.userId;
    if (currentPassword) {
      try {
        await this.lldap.authenticate(session.user.email, currentPassword);
      } catch (error) {
        if (error instanceof LldapAuthenticationError) {
          throw new UnauthorizedException("Current password is incorrect");
        }
        throw error;
      }
      try {
        await this.lldap.changePasswordAsUser(uid, currentPassword, newPassword);
      } catch (error) {
        if (error instanceof LldapAuthenticationError) {
          throw new BadRequestException("Password change failed");
        }
        throw error;
      }
    } else {
      await this.lldap.setPasswordAsAdmin(uid, newPassword);
    }
  }

  /**
   * Starts an email change: validates the new address and mails a code.
   * The new email must not collide with an existing identity (no auto-merge).
   */
  async requestEmailChange(session: Session, rawEmail: string) {
    const newEmail = rawEmail.toLowerCase().trim();
    if (newEmail === session.user.email.toLowerCase()) {
      throw new BadRequestException("This is already your email address");
    }
    if (!isEmailDomainAllowed(newEmail, this.config.allowedDomains)) {
      throw new BadRequestException("Email domain is not allowed");
    }
    if (await this.lldap.resolveUidByEmail(newEmail)) {
      throw new ConflictException("Email address is already in use");
    }
    const collision = await this.prisma.account.findFirst({
      where: { email: newEmail, verified: true },
    });
    if (collision) {
      throw new ConflictException("Email address is already in use");
    }
    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const pending: EmailChangePending = {
      newEmail,
      codeHash: createHash("sha256").update(code).digest("hex"),
      expiresAt: new Date(Date.now() + EMAIL_CHANGE_TTL_MS).toISOString(),
      attempts: 0,
    };
    await this.prisma.platformSetting.upsert({
      where: { key: this.pendingKey(session.user.userId) },
      create: { key: this.pendingKey(session.user.userId), value: pending as object, updatedBy: session.user.userId },
      update: { value: pending as object, updatedBy: session.user.userId },
    });
    try {
      await this.mail.send({
        to: newEmail,
        subject: "Confirm your new email address",
        text: `Your email change code is: ${code}\n\nThe code expires in 10 minutes.`,
        html: `<p>Your email change code is:</p><p style="font-size: 24px; letter-spacing: 4px; font-weight: bold;">${code}</p><p>The code expires in 10 minutes.</p>`,
      });
    } catch {
      throw new BadRequestException("Unable to send the confirmation email");
    }
    return { email: newEmail };
  }

  /**
   * Confirms an email change and migrates the identity: creates the new lldap
   * user, copies group memberships, repoints sessions/accounts, deletes the
   * old lldap user and revokes other sessions.
   */
  async confirmEmailChange(session: Session, code: string): Promise<{ email: string }> {
    const key = this.pendingKey(session.user.userId);
    const row = await this.prisma.platformSetting.findUnique({ where: { key } });
    const pending = (row?.value ?? null) as EmailChangePending | null;
    if (!pending || new Date(pending.expiresAt).getTime() < Date.now()) {
      throw new BadRequestException("Verification code expired. Request a new one.");
    }
    if (!this.constantTimeEqual(pending.codeHash, createHash("sha256").update(code).digest("hex"))) {
      const attempts = pending.attempts + 1;
      if (attempts >= EMAIL_CHANGE_MAX_ATTEMPTS) {
        await this.prisma.platformSetting.deleteMany({ where: { key } });
        throw new BadRequestException("Too many attempts. Request a new code.");
      }
      await this.prisma.platformSetting.update({
        where: { key },
        data: { value: { ...pending, attempts } as object },
      });
      throw new BadRequestException("Invalid verification code");
    }
    const oldUid = session.user.userId;
    const newEmail = pending.newEmail;
    if (await this.lldap.resolveUidByEmail(newEmail)) {
      throw new ConflictException("Email address is already in use");
    }
    const oldUser = await this.lldap.getUserById(oldUid);
    const groups = await this.lldap.listGroups();
    const memberOf = groups.filter((g) => g.members.includes(oldUid));
    await this.lldap.createUser({
      uid: newEmail,
      email: newEmail,
      displayName: oldUser?.name ?? newEmail,
    });
    const fresh = await this.lldap.listGroups();
    for (const g of memberOf) {
      const target = fresh.find((x) => x.displayName === g.displayName);
      if (target) {
        await this.lldap.addUserToGroup(newEmail, target.id);
      }
    }
    await this.prisma.session.updateMany({
      where: { userId: oldUid },
      data: { userId: newEmail, email: newEmail },
    });
    await this.prisma.account.updateMany({
      where: { userId: oldUid },
      data: { userId: newEmail },
    });
    await this.prisma.platformSetting.deleteMany({ where: { key } });
    await this.lldap.deleteUserAdmin(oldUid);
    await this.prisma.session.updateMany({
      where: { userId: newEmail, id: { not: session.id } },
      data: { revokedAt: new Date() },
    });
    return { email: newEmail };
  }

  private pendingKey(userId: string): string {
    return `email-change.${userId}`;
  }

  private constantTimeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  }
}
