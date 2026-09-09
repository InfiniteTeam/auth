/**
 * OAuth state service — mints and verifies signed `state` packets for the
 * social authorization-code flow.
 *
 * The `inft_oauth_state` cookie carries a JSON payload signed with the session
 * secret (`<base64url(payload)>.<hmac>`), mirroring the session cookie design.
 * The payload binds the request to a provider, embeds the CSPRNG `state`
 * (verified against the callback query parameter) and, for Discord, the PKCE
 * `code_verifier` that must survive the round trip.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "../config/config.js";
import type { SocialProviderId } from "./social.types.js";

/** Payload embedded in the signed OAuth state cookie. */
export interface OAuthStatePayload {
  readonly provider: SocialProviderId;
  /** CSPRNG `state` value also sent as the provider query parameter. */
  readonly state: string;
  /** PKCE `code_verifier` (Discord only). */
  readonly codeVerifier?: string;
  /** Millisecond timestamp at which the packet was issued. */
  readonly issuedAt: number;
}

/** Result of minting a state packet. */
export interface OAuthStateCreated {
  /** The `state` query parameter to append to the authorization URL. */
  readonly state: string;
  /** PKCE `code_verifier` the calling endpoint must discard after the round trip. */
  readonly codeVerifier?: string;
  /** Cookie value to set on the client. */
  readonly cookieValue: string;
}

/**
 * Header prefix that distinguishes OAuth state cookies from other cookies.
 */
export const OAUTH_STATE_COOKIE_NAME = "inft_oauth_state";

const STATE_BYTES = 24;
const CODE_VERIFIER_BYTES = 48;

@Injectable()
export class OAuthStateService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  /**
   * Mints a signed `state` packet for a provider. When `withPkce` is set a
   * PKCE `code_verifier` is generated and embedded so it survives the
   * provider round trip.
   */
  create(provider: SocialProviderId, withPkce: boolean): OAuthStateCreated {
    const payload: OAuthStatePayload = {
      provider,
      state: randomBytes(STATE_BYTES).toString("base64url"),
      codeVerifier: withPkce ? randomBytes(CODE_VERIFIER_BYTES).toString("base64url") : undefined,
      issuedAt: Date.now(),
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return {
      state: payload.state,
      codeVerifier: payload.codeVerifier,
      cookieValue: `${encoded}.${this.sign(encoded)}`,
    };
  }

  /**
   * Verifies a raw cookie value against the callback `state` query parameter.
   * Returns the payload on success, `null` on any mismatch, tampering or
   * expiry.
   */
  verify(
    rawCookie: string | undefined | null,
    state: string,
  ): OAuthStatePayload | null {
    if (!rawCookie) {
      return null;
    }
    const dot = rawCookie.lastIndexOf(".");
    if (dot <= 0 || dot >= rawCookie.length - 1) {
      return null;
    }
    const encoded = rawCookie.slice(0, dot);
    const signature = rawCookie.slice(dot + 1);
    if (!this.matches(encoded, signature)) {
      return null;
    }
    try {
      const payload = JSON.parse(
        Buffer.from(encoded, "base64url").toString("utf8"),
      ) as OAuthStatePayload;
      if (
        typeof payload.state !== "string" ||
        typeof payload.provider !== "string" ||
        typeof payload.issuedAt !== "number" ||
        payload.state !== state
      ) {
        return null;
      }
      const ttlMs = this.config.oauthStateTtlMs;
      if (Date.now() - payload.issuedAt > ttlMs || payload.issuedAt > Date.now()) {
        return null;
      }
      return payload;
    } catch {
      return null;
    }
  }

  /**
   * Cookie attributes for the `inft_oauth_state` cookie. `Secure` is applied
   * in `production` only, matching the session cookie.
   */
  get cookieOptions(): {
    httpOnly: boolean;
    secure: boolean;
    sameSite: "lax";
    path: string;
    maxAge: number;
  } {
    return {
      httpOnly: true,
      secure: this.config.nodeEnv === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.ceil(this.config.oauthStateTtlMs / 1000),
    };
  }

  private sign(data: string): string {
    return createHmac("sha256", this.config.sessionSecret)
      .update(`oauth-state:${data}`)
      .digest("hex");
  }

  private matches(data: string, signature: string): boolean {
    const expected = this.sign(data);
    const expectedBuf = Buffer.from(expected, "utf8");
    const signatureBuf = Buffer.from(signature, "utf8");
    if (expectedBuf.length !== signatureBuf.length) {
      return false;
    }
    return timingSafeEqual(expectedBuf, signatureBuf);
  }
}