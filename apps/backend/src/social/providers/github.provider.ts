/**
 * GitHub OAuth provider — implements the authorization-code flow with the
 * official `@octokit/oauth-app` SDK.
 *
 * The provider reads its client credentials and org gate through
 * {@link SocialSettingsService} (env defaults overridden by `PlatformSetting`).
 * Profile resolution prefers verified emails; membership gating is enforced
 * when an org is configured.
 */

import { Inject, Injectable } from "@nestjs/common";
import { OAuthApp } from "@octokit/oauth-app";
import { Octokit as RestOctokit } from "@octokit/rest";
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

const SCOPES_BASE = ["read:user", "user:email"];

@Injectable()
export class GithubProvider implements SocialProvider {
  readonly id: SocialProviderId = "github";
  readonly requiresPkce = false;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly settings: SocialSettingsService,
  ) {}

  async authorizationUrl(input: AuthorizationUrlInput): Promise<string> {
    const oauth = await this.settings.getProviderOauth("github");
    const gate = await this.settings.getGithubGate();
    const scopes = gate.org ? [...SCOPES_BASE, "read:org"] : SCOPES_BASE;
    const { url } = this.app(oauth.clientId, oauth.clientSecret).getWebFlowAuthorizationUrl({
      state: input.state,
      redirectUrl: input.redirectUri,
      scopes,
    });
    return url;
  }

  async exchangeCode(input: {
    code: string;
    redirectUri: string;
    codeVerifier?: string;
  }): Promise<SocialTokenResult> {
    const oauth = await this.settings.getProviderOauth("github");
    try {
      const { authentication } = await this.app(
        oauth.clientId,
        oauth.clientSecret,
      ).createToken({ code: input.code, redirectUrl: input.redirectUri });
      const token = "token" in authentication ? authentication.token : undefined;
      if (!token) {
        throw new SocialOAuthError("github");
      }
      return { accessToken: token, scope: authentication.scopes?.join(" ") };
    } catch (error) {
      if (error instanceof SocialOAuthError) {
        throw error;
      }
      throw new SocialOAuthError("github", "GitHub code exchange failed");
    }
  }

  async fetchProfile(accessToken: string): Promise<SocialProfile> {
    const octokit = await this.userOctokit(accessToken);
    try {
      const [userRes, emailsRes] = await Promise.all([
        octokit.rest.users.getAuthenticated(),
        octokit.rest.users.listEmailsForAuthenticatedUser(),
      ]);
      const verified = (emailsRes.data ?? []).filter((entry) => entry.verified);
      const email =
        verified.find((entry) => entry.primary)?.email ??
        verified[0]?.email ??
        userRes.data.email ??
        "";
      return {
        providerUserId: String(userRes.data.id),
        email,
        name: userRes.data.name || userRes.data.login,
        avatarUrl: userRes.data.avatar_url ?? undefined,
      };
    } catch (error) {
      throw new SocialOAuthError("github", "GitHub profile fetch failed");
    }
  }

  async assertMembership(accessToken: string): Promise<void> {
    const gate = await this.settings.getGithubGate();
    if (!gate.org) {
      return;
    }
    const octokit = await this.userOctokit(accessToken);
    try {
      const { data } = await octokit.rest.orgs.listMembershipsForAuthenticatedUser({
        state: "active",
      });
      const isMember = data.some(
        (membership) => membership.organization.login === gate.org,
      );
      if (!isMember) {
        throw new SocialMembershipError("github", gate.org);
      }
    } catch (error) {
      if (error instanceof SocialMembershipError) {
        throw error;
      }
      throw new SocialOAuthError("github", "GitHub membership check failed");
    }
  }

  private app(clientId: string, clientSecret: string): OAuthApp {
    return new OAuthApp({
      clientType: "oauth-app",
      clientId,
      clientSecret,
      Octokit: RestOctokit,
    });
  }

  /**
   * Builds a user-scoped Octokit (rest endpoints available) from an access
   * token. Uses the app-level client id/secret; the app instance is cheap and
   * scoped per request.
   */
  private async userOctokit(accessToken: string): Promise<RestOctokit> {
    const oauth = await this.settings.getProviderOauth("github");
    // `getUserOctokit` is typed over the core Octokit; with the rest plugin
    // injected at construction the returned instance also carries `.rest`.
    return (await this.app(oauth.clientId, oauth.clientSecret).getUserOctokit({
      token: accessToken,
      scopes: SCOPES_BASE,
    })) as unknown as RestOctokit;
  }
}