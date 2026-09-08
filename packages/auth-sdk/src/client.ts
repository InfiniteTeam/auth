/**
 * The {@link OidcClient} — a minimal, runtime-agnostic OpenID Connect client
 * for consumer services.
 *
 * Nothing in this file creates or stores credentials on its own. Secrets such
 * as `clientSecret`, refresh tokens and ID tokens are either supplied at
 * construction time (see {@link OidcClientOptions}) or passed per call.
 */

import { OIDC_ERROR_CODES, OidcError, type OidcErrorCode } from "./errors.js";
import {
  createLocalJwkSet,
  verifyJwt,
  type JsonWebKeySet,
  type LocalJwkSet,
} from "./jwt.js";
import type {
  AuthFlowOptions,
  AuthFlowResult,
  CallbackResult,
  LoginClaims,
  OidcClientOptions,
  OidcDiscovery,
  PkcePair,
  TokenResponse,
  UserInfo,
  VerifyIdTokenOptions,
} from "./types.js";
import {
  generateNonce,
  generateState,
  randomToken,
  toBase64Url,
} from "./utils.js";

/**
 * Scopes requested during the authorization flow by default.
 */
export const DEFAULT_SCOPES = ["openid", "profile", "email"] as const;

const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const DEFAULT_CACHE_TTL_MS = 60 * 60 * 1000;
const DEFAULT_CLOCK_TOLERANCE_SECONDS = 0;

const WELL_KNOWN_PATH = "/.well-known/openid-configuration";

/**
 * Minimal OpenID Connect client for consumer services.
 *
 * Handles discovery, PKCE authorization URL generation, code exchange, ID
 * token verification (JWKS), token refresh, RP-Initiated logout and userinfo
 * retrieval against an inft-auth (or any OIDC-compliant) provider.
 */
export class OidcClient {
  private readonly options: OidcClientOptions;

  /**
   * Cached discovery document with its fetch timestamp.
   */
  private discoveryCache?: { value: OidcDiscovery; fetchedAt: number };

  /**
   * Cached JWKS resolver with its fetch timestamp.
   */
  private jwksCache?: { value: LocalJwkSet; fetchedAt: number };

  constructor(options: OidcClientOptions) {
    if (!options.issuerUrl) {
      throw new OidcError(
        "issuerUrl is required",
        OIDC_ERROR_CODES.MISSING_OPTION,
      );
    }
    if (!options.clientId) {
      throw new OidcError(
        "clientId is required",
        OIDC_ERROR_CODES.MISSING_OPTION,
      );
    }
    if (
      options.tokenEndpointAuthMethod === "client_secret_basic" &&
      !options.clientSecret
    ) {
      throw new OidcError(
        "clientSecret is required when tokenEndpointAuthMethod is client_secret_basic",
        OIDC_ERROR_CODES.MISSING_OPTION,
      );
    }
    this.options = {
      scopes: [...DEFAULT_SCOPES],
      tokenEndpointAuthMethod: "client_secret_post",
      requestTimeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
      discoveryCacheTtlMs: DEFAULT_CACHE_TTL_MS,
      jwksCacheTtlMs: DEFAULT_CACHE_TTL_MS,
      clockToleranceSeconds: DEFAULT_CLOCK_TOLERANCE_SECONDS,
      ...options,
    };
  }

  private get issuerUrl(): string {
    return this.options.issuerUrl.replace(/\/$/, "");
  }

  /**
   * Executes a fetch with the default timeout and the caller-supplied fetch
   * implementation (when provided). Network errors and timeouts are wrapped
   * in an {@link OidcError} carrying the given error code.
   */
  private async doFetch(
    url: string,
    init: RequestInit | undefined,
    errorCode: OidcErrorCode,
  ): Promise<Response> {
    const fetchImpl = this.options.fetch ?? fetch;
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
    );
    try {
      return await fetchImpl(url, { ...init, signal: controller.signal });
    } catch (err) {
      if (err instanceof OidcError) {
        throw err;
      }
      throw new OidcError(
        `Request to ${url} failed: ${(err as Error).message}`,
        errorCode,
        undefined,
        err,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Headers required for `client_secret_basic` token-endpoint authentication.
   */
  private get tokenAuthBasicHeader(): Record<string, string> | undefined {
    const { clientId, clientSecret, tokenEndpointAuthMethod } = this.options;
    if (tokenEndpointAuthMethod !== "client_secret_basic" || !clientSecret) {
      return undefined;
    }
    const credentials = btoa(`${clientId}:${clientSecret}`);
    return { Authorization: `Basic ${credentials}` };
  }

  /**
   * Fetches and caches the OIDC discovery document
   * (`/.well-known/openid-configuration`).
   */
  async discovery(): Promise<OidcDiscovery> {
    const ttl = this.options.discoveryCacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    if (
      this.discoveryCache &&
      Date.now() - this.discoveryCache.fetchedAt < ttl
    ) {
      return this.discoveryCache.value;
    }

    const res = await this.doFetch(
      `${this.issuerUrl}${WELL_KNOWN_PATH}`,
      undefined,
      OIDC_ERROR_CODES.DISCOVERY_FAILED,
    );
    if (!res.ok) {
      throw new OidcError(
        `OIDC discovery failed: ${res.status}`,
        OIDC_ERROR_CODES.DISCOVERY_FAILED,
        res.status,
      );
    }
    const value = (await res.json()) as OidcDiscovery;
    this.discoveryCache = { value, fetchedAt: Date.now() };
    return value;
  }

  /**
   * Resolves (and caches) the JWKS resolver for the provider's `jwks_uri`.
   */
  private async resolveJwks(): Promise<LocalJwkSet> {
    const meta = await this.discovery();
    if (!meta.jwks_uri) {
      throw new OidcError(
        "Provider does not expose a jwks_uri",
        OIDC_ERROR_CODES.JWKS_UNAVAILABLE,
      );
    }

    const ttl = this.options.jwksCacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    if (this.jwksCache && Date.now() - this.jwksCache.fetchedAt < ttl) {
      return this.jwksCache.value;
    }

    const res = await this.doFetch(
      meta.jwks_uri,
      undefined,
      OIDC_ERROR_CODES.JWKS_UNAVAILABLE,
    );
    if (!res.ok) {
      throw new OidcError(
        `Failed to fetch JWKS: ${res.status}`,
        OIDC_ERROR_CODES.JWKS_UNAVAILABLE,
        res.status,
      );
    }
    const jwks = (await res.json()) as JsonWebKeySet;
    const value = createLocalJwkSet(jwks);
    this.jwksCache = { value, fetchedAt: Date.now() };
    return value;
  }

  /**
   * Generates a PKCE (RFC 7636) verifier / S256 challenge pair.
   */
  static async createPkcePair(): Promise<PkcePair> {
    const verifier = randomToken(64);
    const data = new TextEncoder().encode(verifier);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return { verifier, challenge: toBase64Url(digest) };
  }

  /**
   * Builds an authorization request URL against the provider's
   * `authorization_endpoint`, including PKCE parameters.
   */
  async buildAuthorizationUrl(params: {
    pkce: PkcePair;
    state?: string;
    nonce?: string;
    prompt?: "none" | "login" | "consent" | "select_account";
    redirectUri: string;
  }): Promise<string> {
    const meta = await this.discovery();
    const url = new URL(meta.authorization_endpoint);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", this.options.clientId);
    url.searchParams.set("redirect_uri", params.redirectUri);
    url.searchParams.set(
      "scope",
      (this.options.scopes ?? DEFAULT_SCOPES).join(" "),
    );
    url.searchParams.set("code_challenge", params.pkce.challenge);
    url.searchParams.set("code_challenge_method", "S256");
    if (params.state) {
      url.searchParams.set("state", params.state);
    }
    if (params.nonce) {
      url.searchParams.set("nonce", params.nonce);
    }
    if (params.prompt) {
      url.searchParams.set("prompt", params.prompt);
    }
    return url.toString();
  }

  /**
   * Starts an authorization flow in one call: generates PKCE, state and nonce,
   * and returns the authorization URL plus every value needed at the callback.
   */
  async startAuthFlow(options: AuthFlowOptions): Promise<AuthFlowResult> {
    if (!options.redirectUri) {
      throw new OidcError(
        "redirectUri is required to start an authorization flow",
        OIDC_ERROR_CODES.MISSING_REDIRECT_URI,
      );
    }
    const pkce = await OidcClient.createPkcePair();
    const state = options.state ?? generateState();
    const nonce = options.nonce ?? generateNonce();
    const url = await this.buildAuthorizationUrl({
      redirectUri: options.redirectUri,
      pkce,
      state,
      nonce,
      prompt: options.prompt,
    });
    return { url, verifier: pkce.verifier, state, nonce };
  }

  /**
   * Exchanges an authorization code for tokens using the PKCE verifier.
   */
  async exchangeCode(
    code: string,
    params: { verifier: string; redirectUri: string },
  ): Promise<TokenResponse> {
    const meta = await this.discovery();
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: params.redirectUri,
      client_id: this.options.clientId,
      code_verifier: params.verifier,
    });
    if (
      this.options.tokenEndpointAuthMethod === "client_secret_post" &&
      this.options.clientSecret
    ) {
      body.set("client_secret", this.options.clientSecret);
    }

    const res = await this.doFetch(
      meta.token_endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          ...this.tokenAuthBasicHeader,
        },
        body,
      },
      OIDC_ERROR_CODES.TOKEN_EXCHANGE_FAILED,
    );
    if (!res.ok) {
      throw new OidcError(
        `Token exchange failed: ${res.status}`,
        OIDC_ERROR_CODES.TOKEN_EXCHANGE_FAILED,
        res.status,
      );
    }
    return (await res.json()) as TokenResponse;
  }

  /**
   * Exchanges a refresh token for a new access token. The refresh token is
   * passed in and kept by the consumer — it is never stored on the client.
   */
  async refreshToken(
    refreshToken: string,
    options?: { scopes?: string[] },
  ): Promise<TokenResponse> {
    const meta = await this.discovery();
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: this.options.clientId,
    });
    if (options?.scopes && options.scopes.length > 0) {
      body.set("scope", options.scopes.join(" "));
    }
    if (
      this.options.tokenEndpointAuthMethod === "client_secret_post" &&
      this.options.clientSecret
    ) {
      body.set("client_secret", this.options.clientSecret);
    }

    const res = await this.doFetch(
      meta.token_endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          ...this.tokenAuthBasicHeader,
        },
        body,
      },
      OIDC_ERROR_CODES.REFRESH_FAILED,
    );
    if (!res.ok) {
      throw new OidcError(
        `Token refresh failed: ${res.status}`,
        OIDC_ERROR_CODES.REFRESH_FAILED,
        res.status,
      );
    }
    return (await res.json()) as TokenResponse;
  }

  /**
   * Verifies an ID token's signature and claims (issuer, client audience,
   * algorithms, timestamps and optional nonce) against the provider's JWKS.
   */
  async verifyIdToken(
    idToken: string,
    options?: VerifyIdTokenOptions,
  ): Promise<LoginClaims> {
    const meta = await this.discovery();
    const jwks = await this.resolveJwks();
    return verifyJwt(idToken, jwks, {
      issuer: meta.issuer,
      audience: options?.audience ?? this.options.clientId,
      nonce: options?.nonce,
      algorithms:
        options?.algorithms ??
        this.options.algorithms ??
        meta.id_token_signing_alg_values_supported,
      clockTolerance:
        options?.clockTolerance ?? this.options.clockToleranceSeconds,
    });
  }

  /**
   * Fetches user claims from the userinfo endpoint.
   */
  async getUserinfo(accessToken: string): Promise<UserInfo> {
    const meta = await this.discovery();
    if (!meta.userinfo_endpoint) {
      throw new OidcError(
        "Provider does not expose a userinfo endpoint",
        OIDC_ERROR_CODES.USERINFO_FAILED,
      );
    }
    const res = await this.doFetch(
      meta.userinfo_endpoint,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
      OIDC_ERROR_CODES.USERINFO_FAILED,
    );
    if (!res.ok) {
      throw new OidcError(
        `Userinfo request failed: ${res.status}`,
        OIDC_ERROR_CODES.USERINFO_FAILED,
        res.status,
      );
    }
    return (await res.json()) as UserInfo;
  }

  /**
   * Builds an RP-Initiated Logout (OIDC RP-Initiated Logout 1.0) URL. The ID
   * token to send as `id_token_hint` is supplied by the caller.
   */
  async buildEndSessionUrl(params: {
    idToken: string;
    postLogoutRedirectUri?: string;
  }): Promise<string> {
    const meta = await this.discovery();
    if (!meta.end_session_endpoint) {
      throw new OidcError(
        "Provider does not advertise an end_session_endpoint",
        OIDC_ERROR_CODES.LOGOUT_NOT_SUPPORTED,
      );
    }
    const url = new URL(meta.end_session_endpoint);
    url.searchParams.set("id_token_hint", params.idToken);
    if (params.postLogoutRedirectUri) {
      url.searchParams.set(
        "post_logout_redirect_uri",
        params.postLogoutRedirectUri,
      );
    }
    return url.toString();
  }

  /**
   * Convenience method: exchanges a code, verifies the ID token (optionally
   * against the flow nonce) and fetches the user profile in one step.
   */
  async handleCallback(
    code: string,
    params: {
      verifier: string;
      redirectUri: string;
      nonce?: string;
    },
  ): Promise<CallbackResult> {
    const tokens = await this.exchangeCode(code, params);
    const claims = await this.verifyIdToken(tokens.id_token, {
      nonce: params.nonce,
    });
    const user = await this.getUserinfo(tokens.access_token);
    return { tokens, claims, user };
  }
}
