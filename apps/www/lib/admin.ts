/**
 * Client-side wrapper for the admin OIDC client management API
 * (`/api/v1/admin/clients`).
 *
 * The admin API lives outside the shared `@inftkr/auth-core` contract and is
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

/** Rotates a client secret; the new secret is returned exactly once. */
export async function rotateClientSecret(clientId: string): Promise<CreateOidcClientResult> {
  return adminRequest<CreateOidcClientResult>(`/${encodeURIComponent(clientId)}/rotate`, {
    method: 'POST',
  });
}

/** Updates a client's redirect URIs / display name. */
export async function updateClient(
  clientId: string,
  input: { redirectUris?: string[]; clientName?: string },
): Promise<AdminOidcClient> {
  return adminRequest<AdminOidcClient>(`/${encodeURIComponent(clientId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

function apiUrl(path: string): string {
  return `${BACKEND_URL}${path}`;
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
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

/** A directory user as returned by the admin API. */
export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  groups: string[];
}

/** A directory group as returned by the admin API. */
export interface AdminGroup {
  id: number;
  displayName: string;
  members: string[];
}

/** A session row as returned by the admin API. */
export interface AdminSession {
  id: string;
  userId: string;
  email: string;
  provider: string;
  issuedAt: string;
  expiresAt: string;
  revokedAt: string | null;
  active: boolean;
}

/** A platform setting entry as returned by the admin API. */
export interface AdminSetting {
  key: string;
  group: string;
  label: string;
  value?: unknown;
  configured?: boolean;
  source: 'env' | 'override';
  requiresRestart: boolean;
  secret: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

/** Lists directory users. */
export async function listUsers(search?: string): Promise<AdminUser[]> {
  const params = search ? `?search=${encodeURIComponent(search)}` : '';
  const data = await apiRequest<{ users: AdminUser[] }>(`/api/v1/admin/users${params}`);
  return data.users;
}

/** Updates a directory user. */
export async function updateUser(
  id: string,
  input: { email?: string; displayName?: string },
): Promise<AdminUser> {
  return apiRequest<AdminUser>(`/api/v1/admin/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

/** Deletes a directory user. */
export async function deleteUser(id: string): Promise<void> {
  await apiRequest<void>(`/api/v1/admin/users/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

/** Lists directory groups. */
export async function listGroups(): Promise<AdminGroup[]> {
  const data = await apiRequest<{ groups: AdminGroup[] }>('/api/v1/admin/groups');
  return data.groups;
}

/** Creates a directory group. */
export async function createGroup(displayName: string): Promise<AdminGroup> {
  return apiRequest<AdminGroup>('/api/v1/admin/groups', {
    method: 'POST',
    body: JSON.stringify({ displayName }),
  });
}

/** Deletes a directory group. */
export async function deleteGroup(id: number): Promise<void> {
  await apiRequest<void>(`/api/v1/admin/groups/${id}`, { method: 'DELETE' });
}

/** Adds a user to a group. */
export async function addGroupMember(groupId: number, userId: string): Promise<void> {
  await apiRequest<void>(`/api/v1/admin/groups/${groupId}/members`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}

/** Removes a user from a group. */
export async function removeGroupMember(groupId: number, userId: string): Promise<void> {
  await apiRequest<void>(
    `/api/v1/admin/groups/${groupId}/members/${encodeURIComponent(userId)}`,
    { method: 'DELETE' },
  );
}

/** Lists sessions. */
export async function listSessions(userId?: string): Promise<AdminSession[]> {
  const params = userId ? `?userId=${encodeURIComponent(userId)}` : '';
  const data = await apiRequest<{ sessions: AdminSession[] }>(`/api/v1/admin/sessions${params}`);
  return data.sessions;
}

/** Revokes a session by id. */
export async function revokeSession(id: string): Promise<void> {
  await apiRequest<void>(`/api/v1/admin/sessions/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

/** Lists platform settings with effective values. */
export async function listSettings(): Promise<AdminSetting[]> {
  const data = await apiRequest<{ settings: AdminSetting[] }>('/api/v1/admin/settings');
  return data.settings;
}

/** Sets or clears a setting override (`null` clears to env default). */
export async function setSetting(key: string, value: unknown): Promise<AdminSetting> {
  const data = await apiRequest<{ setting: AdminSetting }>(
    `/api/v1/admin/settings/${encodeURIComponent(key)}`,
    { method: 'PUT', body: JSON.stringify({ value }) },
  );
  return data.setting;
}

/** Deployment metadata (issuer, callbacks, domains). */
export interface AdminMeta {
  issuerUrl: string;
  rootDomain: string;
  allowedDomains: string[];
  githubCallbackUrl: string;
  discordCallbackUrl: string;
}

/** Returns deployment metadata. */
export async function getAdminMeta(): Promise<AdminMeta> {
  return apiRequest<AdminMeta>('/api/v1/admin/meta');
}