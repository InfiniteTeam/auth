import type {
  CallbackResult,
  OidcClientOptions,
  OidcDiscovery,
  PkcePair,
  TokenResponse,
  UserInfo,
} from "./types.js";

const DEFAULT_SCOPES = ["openid", "profile", "email"];

function randomToken(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function toBase64Url(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Minimal OpenID Connect client for consumer services.
 *
 * Handles discovery, PKCE authorization URL generation, code exchange and
 * userinfo retrieval against an inft-auth (or any OIDC-compliant) provider.
 */
export class OidcClient {
  private readonly options: OidcClientOptions;
  private discoveryCache?: OidcDiscovery;

  constructor(options: OidcClientOptions) {
    if (!options.issuerUrl) {
      throw new Error("issuerUrl is required");
    }
    this.options = {
      scopes: DEFAULT_SCOPES,
      ...options,
    };
  }

  private get issuerUrl(): string {
    return this.options.issuerUrl.replace(/\/$/, "");
  }

  /**
   * Fetches OIDC discovery metadata from `/.well-known/openid-configuration`.
   */
  async discovery(): Promise<OidcDiscovery> {
    if (this.discoveryCache) {
      return this.discoveryCache;
    }
    const res = await fetch(`${this.issuerUrl}/.well-known/openid-configuration`);
    if (!res.ok) {
      throw new Error(`OIDC discovery failed: ${res.status}`);
    }
    this.discoveryCache = (await res.json()) as OidcDiscovery;
    return this.discoveryCache;
  }

  /**
   * Generates a PKCE challenge pair for the authorization code flow.
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
    url.searchParams.set("scope", (this.options.scopes ?? DEFAULT_SCOPES).join(" "));
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
    if (this.options.clientSecret) {
      body.set("client_secret", this.options.clientSecret);
    }

    const res = await fetch(meta.token_endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) {
      throw new Error(`Token exchange failed: ${res.status}`);
    }
    return (await res.json()) as TokenResponse;
  }

  /**
   * Fetches user claims from the userinfo endpoint.
   */
  async getUserinfo(accessToken: string): Promise<UserInfo> {
    const meta = await this.discovery();
    if (!meta.userinfo_endpoint) {
      throw new Error("Provider does not expose a userinfo endpoint");
    }
    const res = await fetch(meta.userinfo_endpoint, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`Userinfo request failed: ${res.status}`);
    }
    return (await res.json()) as UserInfo;
  }

  /**
   * Convenience method: exchanges a code and fetches the user profile in one step.
   */
  async handleCallback(
    code: string,
    params: { verifier: string; redirectUri: string },
  ): Promise<CallbackResult> {
    const tokens = await this.exchangeCode(code, params);
    const user = await this.getUserinfo(tokens.access_token);
    return { tokens, user };
  }
}