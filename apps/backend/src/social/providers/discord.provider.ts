/**
 * Discord OAuth provider — implements the authorization-code flow with PKCE
 * S256 using the official `@discordjs/core` / `@discordjs/rest` SDKs.
 *
 * Client credentials and the guild gate are resolved through
 * {@link SocialSettingsService}. PKCE is mandatory for this provider: the
 * `code_verifier` travels in the signed OAuth state cookie.
 */

import { createHash } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { OAuth2API } from "@discordjs/core";
import { REST } from "@discordjs/rest";
import type {
  RESTGetAPICurrentUserResult,
  RESTPostOAuth2AccessTokenURLEncodedData,
} from "discord-api-types/v10";
import { APP_CONFIG, type AppConfig } from "../../config/config.js";
import { SocialSettingsService } from "../social-settings.service.js";
import {
  SocialMembershipError,
  SocialOAuthError,
  type SocialProfile,
  type SocialProviderId,
  type SocialTokenResult,
} from "../social.types.js";
import type {
  AuthorizationUrlInput,
  SocialProvider,
} from "./provider.interface.js";

const SCOPES_BASE = ["identify", "email"];

@Injectable()
export class DiscordProvider implements SocialProvider {
  readonly id: SocialProviderId = "discord";
  readonly requiresPkce = true;

  private readonly logger = new Logger(DiscordProvider.name);

  private readonly rest: REST;
  private readonly oauth2: OAuth2API;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly settings: SocialSettingsService,
  ) {
    this.rest = new REST({ version: "10" });
    this.oauth2 = new OAuth2API(this.rest);
  }

  async authorizationUrl(input: AuthorizationUrlInput): Promise<string> {
    const oauth = await this.settings.getProviderOauth("discord");
    const gate = await this.settings.getDiscordGate();
    const scopes = [...SCOPES_BASE];
    if (gate.guildId) {
      scopes.push("guilds");
    }
    if (gate.roleIds.length) {
      scopes.push("guilds.members.read");
    }
    const url = this.oauth2.generateAuthorizationURL({
      response_type: "code",
      client_id: oauth.clientId,
      scope: scopes.join(" "),
      redirect_uri: input.redirectUri,
      state: input.state,
    });
    if (input.codeChallenge) {
      const query = new URLSearchParams({
        code_challenge: this.s256Challenge(input.codeChallenge),
        code_challenge_method: "S256",
      });
      return `${url}${url.includes("?") ? "&" : "?"}${query.toString()}`;
    }
    return url;
  }

  /** RFC 7636 S256 challenge: `base64url(SHA-256(code_verifier))`. */
  private s256Challenge(codeVerifier: string): string {
    return createHash("sha256").update(codeVerifier).digest("base64url");
  }

  async exchangeCode(input: {
    code: string;
    redirectUri: string;
    codeVerifier?: string;
  }): Promise<SocialTokenResult> {
    const oauth = await this.settings.getProviderOauth("discord");
    const body: RESTPostOAuth2AccessTokenURLEncodedData & { code_verifier?: string } = {
      grant_type: "authorization_code",
      client_id: oauth.clientId,
      client_secret: oauth.clientSecret,
      code: input.code,
      redirect_uri: input.redirectUri,
    };
    if (input.codeVerifier) {
      body.code_verifier = input.codeVerifier;
    }
    try {
      const result = await this.oauth2.tokenExchange(body);
      return {
        accessToken: result.access_token,
        refreshToken: result.refresh_token,
        scope: result.scope,
        expiresAt: new Date(Date.now() + result.expires_in * 1000),
      };
    } catch (error) {
      this.logger.warn(
        `Discord code exchange failed: ${this.describe(error)}`,
      );
      throw new SocialOAuthError("discord", "Discord code exchange failed");
    }
  }

  async fetchProfile(accessToken: string): Promise<SocialProfile> {
    try {
      const user = (await this.api(
        "users/@me",
        accessToken,
      )) as RESTGetAPICurrentUserResult;
      this.logger.log(
        `Discord @me: user=${user.id} email=${user.email ? "set" : "EMPTY"} verified=${String(user.verified ?? "?")}`,
      );
      return {
        providerUserId: user.id,
        email: user.email ?? "",
        name: user.global_name ?? user.username,
        avatarUrl: user.avatar
          ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
          : undefined,
      };
    } catch (error) {
      this.logger.warn(
        `Discord profile fetch failed: ${this.describe(error)}`,
      );
      throw new SocialOAuthError("discord", "Discord profile fetch failed");
    }
  }

  async assertMembership(accessToken: string): Promise<void> {
    const gate = await this.settings.getDiscordGate();
    if (!gate.guildId) {
      return;
    }
    try {
      const guilds = (await this.api(
        "users/@me/guilds",
        accessToken,
      )) as Array<{ id: string }>;
      if (!guilds.some((guild) => guild.id === gate.guildId)) {
        throw new SocialMembershipError("discord", gate.guildId);
      }
      if (gate.roleIds.length) {
        const member = (await this.api(
          `users/@me/guilds/${gate.guildId}/member`,
          accessToken,
        )) as { roles?: string[] };
        const overlap = (member.roles ?? []).filter((role) =>
          gate.roleIds.includes(role),
        );
        if (overlap.length === 0) {
          throw new SocialMembershipError("discord", gate.roleIds.join(","));
        }
      }
    } catch (error) {
      if (error instanceof SocialMembershipError) {
        throw error;
      }
      this.logger.warn(
        `Discord membership check failed: ${this.describe(error)}`,
      );
      throw new SocialOAuthError("discord", "Discord membership check failed");
    }
  }

  /** Authed GET against the Discord API using the user OAuth2 `Bearer` token. */
  private async api(path: string, accessToken: string): Promise<unknown> {
    const response = await fetch(`https://discord.com/api/v10/${path}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "inft-auth/1.0",
      },
    });
    if (!response.ok) {
      throw new SocialOAuthError(
        "discord",
        `Discord API ${path} failed with ${response.status}`,
      );
    }
    return response.json();
  }

  private describe(error: unknown): string {
    if (typeof error === "object" && error !== null) {
      const { status, message, body } = error as Record<string, unknown>;
      const detail =
        typeof body === "string"
          ? (body.slice(0, 200) as string)
          : body
            ? JSON.stringify(body).slice(0, 200)
            : undefined;
      return `${String(status ?? "")} ${detail ?? String(message ?? error)}`.trim();
    }
    return String(error);
  }
}