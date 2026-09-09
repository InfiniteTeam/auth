import type { Session } from "@inft/shared";

/**
 * Configuration options for an {@link AuthApiClient}.
 */
export interface ApiClientOptions {
  /**
   * Base URL of the backend. Use an empty string when running on the same
   * origin (browser) or pass `http://backend:3000` from server-side code.
   */
  baseUrl: string;
  /** Optional custom fetch implementation (useful for tests/undici). */
  fetch?: typeof fetch;
}

/**
 * Error raised by the auth API client for non-2xx responses.
 */
export class AuthApiError extends Error {
  constructor(
    message: string,
    /** HTTP status code returned by the server. */
    readonly statusCode: number,
    /** Machine-readable error code returned by the server. */
    readonly code: string,
  ) {
    super(message);
    this.name = "AuthApiError";
  }
}

/**
 * Credentials used for LDAP-based sign-in.
 */
export interface LdapLoginInput {
  /** User email address. */
  email: string;
  /** Plain-text password. Never logged. */
  password: string;
}

/**
 * Contract describing the authentication endpoints exposed by the backend.
 */
export interface AuthClient {
  /** Fetches the current session, or `null` when unauthenticated. */
  session(): Promise<Session | null>;
  /** Authenticates with LDAP credentials and returns the new session. */
  loginLdap(input: LdapLoginInput): Promise<Session>;
  /** Starts a social (OAuth) sign-in flow for the given provider. */
  loginSocial(provider: "github" | "discord"): Promise<void>;
  /** Destroys the current session. */
  logout(): Promise<void>;
}

/**
 * Typed HTTP client for the inft-auth backend APIs.
 *
 * Attaches cookies on every request and normalizes errors into
 * {@link AuthApiError}. Intended to be shared by backend and frontend
 * code through `@inft/auth-core` (in the spirit of Auth.js).
 */
export class AuthApiClient implements AuthClient {
  constructor(private readonly options: ApiClientOptions) {}

  private get baseUrl(): string {
    return this.options.baseUrl.replace(/\/$/, "");
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await (this.options.fetch ?? fetch)(`${this.baseUrl}${path}`, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      ...init,
    });

    if (res.status === 204) {
      return undefined as T;
    }

    const isJson = res.headers.get("content-type")?.includes("application/json");
    const body = isJson ? await res.json() : undefined;

    if (!res.ok) {
      const error = body as { error?: string; message?: string } | undefined;
      throw new AuthApiError(
        error?.message ?? "Request failed.",
        res.status,
        error?.error ?? "unknown",
      );
    }

    return body as T;
  }

  /** @inheritDoc */
  async session(): Promise<Session | null> {
    try {
      return await this.request<Session>("/api/v1/session");
    } catch (err) {
      if (err instanceof AuthApiError && err.statusCode === 401) {
        return null;
      }
      throw err;
    }
  }

  /** @inheritDoc */
  async loginLdap(input: LdapLoginInput): Promise<Session> {
    return this.request<Session>("/api/v1/auth/ldap", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  /** @inheritDoc */
  async loginSocial(provider: "github" | "discord"): Promise<void> {
    const doFetch = this.options.fetch ?? fetch;
    const res = await doFetch(`${this.baseUrl}/api/v1/auth/social/${provider}`, {
      credentials: "include",
      redirect: "manual",
    });

    const currentWindow = typeof window !== "undefined" ? window : undefined;

    // Browsers expose manual redirects as opaque responses; navigate to the
    // provider page to continue the flow.
    if (res.type === "opaqueredirect") {
      currentWindow?.location.assign(res.url);
      return;
    }

    // Server-side fetchers (e.g. undici) expose the redirect in headers.
    const redirectUrl = res.headers.get("location");
    if (redirectUrl) {
      currentWindow?.location.assign(redirectUrl);
      return;
    }

    if (res.status !== 200) {
      throw new AuthApiError("Unable to start the social sign-in flow.", res.status, "social_failed");
    }
  }

  /** @inheritDoc */
  async logout(): Promise<void> {
    await this.request<void>("/api/v1/session", { method: "DELETE" });
  }
}

/**
 * Convenience factory for {@link AuthApiClient}.
 */
export function createAuthClient(baseUrl: string): AuthApiClient {
  return new AuthApiClient({ baseUrl });
}