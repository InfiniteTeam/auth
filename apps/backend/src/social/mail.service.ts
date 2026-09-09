/**
 * Mail service — sends transactional verification emails over SMTP.
 *
 * The service is inert when `SMTP_HOST` is not configured; every `send` call
 * then fails fast with a `MailNotConfiguredError` so callers never silently
 * swallow a lost verification email.
 */

import { Inject, Injectable } from "@nestjs/common";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { APP_CONFIG, type AppConfig } from "../config/config.js";

/** Error thrown when mail is not configured (no SMTP host). */
export class MailNotConfiguredError extends Error {
  constructor() {
    super("SMTP is not configured");
    this.name = "MailNotConfiguredError";
  }
}

/** A transactional email. */
export interface SendMailInput {
  /** Recipient address. */
  to: string;
  /** Subject line. */
  subject: string;
  /** Plain-text body. */
  text: string;
  /** HTML body (optional). */
  html?: string;
}

/** Email used for the signup verification flow. */
export interface VerificationMailInput {
  /** Recipient address. */
  to: string;
  /** Six-digit verification code. */
  code: string;
  /** One-time verification link. */
  link: string;
}

@Injectable()
export class MailService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  /** Whether the SMTP transport is configured. */
  get enabled(): boolean {
    return Boolean(this.config.smtpHost && this.config.smtpFrom);
  }

  /** Sends a transactional email. Throws when SMTP is not configured. */
  async send(input: SendMailInput): Promise<void> {
    const transporter = this.transporter();
    await transporter.sendMail({
      from: this.config.smtpFrom,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
  }

  /** Sends the signup verification email (code + one-time link). */
  async sendVerificationEmail(input: VerificationMailInput): Promise<void> {
    const ttlMinutes = Math.max(1, Math.ceil(this.config.verificationCodeTtlMs / 60000));
    await this.send({
      to: input.to,
      subject: "Verify your inft-auth account",
      text: [
        `Your inft-auth verification code is: ${input.code}`,
        "",
        `The code expires in ${ttlMinutes} minutes.`,
        "",
        `Or open this link to verify instantly (expires in 24 hours):`,
        input.link,
      ].join("\n"),
      html: [
        `<p>Your inft-auth verification code is:</p>`,
        `<p style="font-size: 24px; letter-spacing: 4px; font-weight: bold;">${input.code}</p>`,
        `<p>The code expires in ${ttlMinutes} minutes.</p>`,
        `<p>Or <a href="${this.escapeHtml(input.link)}">verify your email instantly</a> (expires in 24 hours).</p>`,
      ].join("\n"),
    });
  }

  private transporter(): Transporter {
    const { smtpHost, smtpPort, smtpSecure, smtpUser, smtpPassword, smtpFrom } =
      this.config;
    if (!smtpHost || !smtpFrom) {
      throw new MailNotConfiguredError();
    }
    return nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: smtpUser && smtpPassword ? { user: smtpUser, pass: smtpPassword } : undefined,
    });
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
}