/**
 * Client-side wrapper for the admin OIDC client management API
 * (`/api/v1/admin/clients`).
 *
 * The admin API lives outside the shared `@inft/auth-core` contract and is
 * consumed by the portal's settings page. Requests carry the session cookie
 * (`credentials: "include"`) and normalize failures into {@link AdminApiError}.
 */

import { BACKEND_URL } from './auth';

/**
 * A registered OIDC client as returned by the admin API.
 */
export interface AdminOidcClient {
  /** The generated Snowflake client identifier. */
  clientId: string;
  /** Human-readable client name. */
  clientName?: string;
  /** Allowed redirect URIs. */
  redirectUris: string[];
  /** Grant types the client may use. */
  grantTypes: string[];
  /** Response types the client may use. */
  responseTypes: string[];
  /** Scopes the client may request. */
  scopes: string[];
  /** Token endpoint authentication method. */
  tokenEndpointAuthMethod: string;
  /** ISO 8601 creation timestamp. */
  createdAt: string;
}

/**
 * Payload for registering a new OIDC client.
 */
export interface CreateOidcClientInput {
  /** Human-readable client name shown on the consent screen. */
  clientName?: string;
  /** Allowed redirect URIs; at least one is required. */
  redirectUris: string[];
  /** Grant types the client may use (defaults to `authorization_code`). */
  grantTypes?: string[];
  /** Response types the client may use (defaults to `code`). */
  responseTypes?: string[];
  /** Scopes the client may request (defaults to `openid profile email`). */
  scopes?: string[];
  /** Token endpoint authentication method (defaults to `client_secret_post`). */
  tokenEndpointAuthMethod?: string;
}

/**
 * Response of a successful client registration.
 */
export interface CreateOidcClientResult extends AdminOidcClient {
  /** The client secret. Shown exactly once; never retrievable later. */
  clientSecret: string;
}

/**
 * Error raised by the admin client wrapper for non-2xx responses.
 */
export class AdminApiError extends Error {
  constructor(
    message: string,
    /** HTTP status code returned by the server. */
    readonly statusCode: number,
    /** Machine-readable error code returned by the server. */
    readonly code: string,
  ) {
    super(message);
    this.name = 'AdminApiError';
  }
}

function adminUrl(path = ''): string {
  return `${BACKEND_URL}/api/v1/admin/clients${path}`;
}

async function adminRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(adminUrl(path), {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    ...init,
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json() : undefined;

  if (!res.ok) {
    const error = body as { error?: string; message?: string } | undefined;
    throw new AdminApiError(
      error?.message ?? 'Request failed.',
      res.status,
      error?.error ?? 'unknown',
    );
  }

  return body as T;
}

/** Lists all registered OIDC clients. */
export async function listClients(): Promise<AdminOidcClient[]> {
  const data = await adminRequest<{ clients: AdminOidcClient[] }>('');
  return data.clients;
}

/** Registers a new OIDC client; the client secret is returned exactly once. */
export async function createClient(
  input: CreateOidcClientInput,
): Promise<CreateOidcClientResult> {
  return adminRequest<CreateOidcClientResult>('', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** Deletes a registered OIDC client (built-in clients are rejected). */
export async function deleteClient(clientId: string): Promise<void> {
  await adminRequest<void>(`/${encodeURIComponent(clientId)}`, {
    method: 'DELETE',
  });
}