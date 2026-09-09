/**
 * Discord OAuth provider — implements the authorization-code flow with PKCE
 * S256 using the official `@discordjs/core` / `@discordjs/rest` SDKs.
 *
 * Client credentials and the guild gate are resolved through
 * {@link SocialSettingsService}. PKCE is mandatory for this provider: the
 * `code_verifier` travels in the signed OAuth state cookie.
 */

import { Inject, Injectable } from "@nestjs/common";
import { OAuth2API } from "@discordjs/core";
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v10";
import type {
  RESTGetAPIOAuth2CurrentAuthorizationResult,
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
        code_challenge: input.codeChallenge,
        code_challenge_method: "S256",
      });
      return `${url}${url.includes("?") ? "&" : "?"}${query.toString()}`;
    }
    return url;
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
    } catch {
      throw new SocialOAuthError("discord", "Discord code exchange failed");
    }
  }

  async fetchProfile(accessToken: string): Promise<SocialProfile> {
    this.rest.setToken(accessToken);
    try {
      const result = await this.oauth2.getCurrentAuthorizationInformation();
      const user = this.user(result);
      return {
        providerUserId: user.id,
        email: user.email ?? "",
        name: user.global_name ?? user.username,
        avatarUrl: user.avatar
          ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
          : undefined,
      };
    } catch {
      throw new SocialOAuthError("discord", "Discord profile fetch failed");
    }
  }

  async assertMembership(accessToken: string): Promise<void> {
    const gate = await this.settings.getDiscordGate();
    if (!gate.guildId) {
      return;
    }
    this.rest.setToken(accessToken);
    try {
      const guilds = (await this.rest.get(Routes.userGuilds())) as Array<{ id: string }>;
      if (!guilds.some((guild) => guild.id === gate.guildId)) {
        throw new SocialMembershipError("discord", gate.guildId);
      }
      if (gate.roleIds.length) {
        const member = (await this.rest.get(
          Routes.userGuildMember(gate.guildId),
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
      throw new SocialOAuthError("discord", "Discord membership check failed");
    }
  }

  private user(
    data: RESTGetAPIOAuth2CurrentAuthorizationResult,
  ): {
    id: string;
    username: string;
    global_name?: string | null;
    email?: string | null;
    avatar?: string | null;
  } {
    if (!data.user) {
      throw new SocialOAuthError("discord", "Discord did not return a user");
    }
    return data.user;
  }
}