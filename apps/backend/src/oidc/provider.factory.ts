/**
 * OIDC Provider factory.
 *
 * Builds and configures the single shared `oidc-provider` {@link Provider}.
 * Configuration includes:
 *
 * - the Prisma storage adapter,
 * - the persistent RSA signing key (JWKS),
 * - the `findAccount` hook (backed by lldap),
 * - a seeded static Tailscale custom OIDC client,
 * - the interaction policy required by this platform.
 */

import Provider, {
  type AccountClaims,
  type Configuration,
  type FindAccount,
} from "oidc-provider";
import { OIDC_ISSUER } from "@inftkr/shared";
import { PrismaService } from "../prisma/prisma.service.js";
import type { AppConfig } from "../config/config.js";
import { LldapService } from "../lldap/lldap.service.js";
import { createPrismaAdapterFactory } from "./prisma.adapter.js";
import { loadOrCreateJwks } from "./jwks.js";
import { OIDC_INTERACTION_ROUTE } from "./oidc-routes.js";

/** Redirect URI registered for the Tailscale custom OIDC client. */
export const TAILSCALE_REDIRECT_URI =
  "https://login.tailscale.com/a/oauth_response";
/** Scopes requested by the Tailscale custom OIDC client. */
export const TAILSCALE_SCOPES = ["openid", "profile", "email"];
/** The stable client id used for the Tailscale custom OIDC client. */
export const TAILSCALE_CLIENT_ID = "tailscale";

/**
 * Creates the application {@link Provider}.
 */
export function createProvider(
  config: AppConfig,
  prisma: PrismaService,
  lldapService: LldapService,
): Provider {
  const jwks = loadOrCreateJwks(config.jwksPath);

  const issuer = config.issuerUrl || OIDC_ISSUER;

  const findAccount: FindAccount = async (_ctx, id) => {
    const user = await lldapService.getUserById(id);
    return {
      accountId: id,
      claims: async (use: string, scope: string): Promise<AccountClaims> => {
        void use;
        const claims: AccountClaims = { sub: id };
        if (user) {
          if (scope.includes("profile")) {
            claims.name = user.name;
            claims.preferred_username = user.id;
          }
          if (scope.includes("email")) {
            claims.email = user.email;
            claims.email_verified = true;
          }
        }
        return claims;
      },
    };
  };

  const configuration: Configuration = {
    adapter: createPrismaAdapterFactory(prisma),
    jwks: jwks as unknown as Configuration["jwks"],
    findAccount,
    clients: [
      {
        client_id: TAILSCALE_CLIENT_ID,
        client_secret: config.tailscaleClientSecret,
        redirect_uris: [TAILSCALE_REDIRECT_URI],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "client_secret_post",
        scope: TAILSCALE_SCOPES.join(" "),
      },
    ],
    pkce: {
      required: () => false,
    },
    scopes: ["openid", "profile", "email", "offline_access"],
    claims: {
      openid: ["sub"],
      profile: ["name", "preferred_username"],
      email: ["email", "email_verified"],
    },
    interactions: {
      url: (_ctx) => OIDC_INTERACTION_ROUTE,
    },
    routes: {
      authorization: "/auth",
      token: "/token",
      revocation: "/revoke",
      introspection: "/introspect",
      userinfo: "/userinfo",
      jwks: "/.well-known/jwks.json",
      end_session: "/session/end",
      pushed_authorization_request: "/request",
      device_authorization: "/device/auth",
      code_verification: "/device/conf",
      registration: "/reg",
      backchannel_authentication: "/bc-authorize",
      credential: "/credential",
      challenge: "/challenge",
    },
    cookies: {
      keys: [config.sessionSecret],
    },
    ttl: {
      AccessToken: 60 * 60,
      AuthorizationCode: 10 * 60,
      IdToken: 60 * 60,
      RefreshToken: 60 * 60 * 24 * 14,
      Interaction: 10 * 60,
      Session: 60 * 60 * 24 * 14,
    },
    features: {
      devInteractions: { enabled: config.nodeEnv !== "production" },
      resourceIndicators: { enabled: false },
    },
  };

  const provider = new Provider(config.issuerUrl || OIDC_ISSUER, configuration);
  // The backend serves plain HTTP behind the Cloudflare Tunnel, which
  // forwards the edge scheme via `X-Forwarded-Proto`. Without proxy awareness
  // Koa reports `http`, so the discovery document would advertise `http://`
  // endpoint URLs while the issuer itself is `https://`. Strict consumers
  // (e.g. Tailscale's egress proxy, which only allows TLS) then refuse the
  // token request because the advertised `token_endpoint` is plain HTTP.
  provider.proxy = true;
  return provider;
}
