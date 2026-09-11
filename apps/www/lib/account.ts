/**
 * Client-side wrapper for the self-service account API (`/api/v1/account`).
 */

import { BACKEND_URL } from './auth';
import { AdminApiError } from './admin';

async function accountRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BACKEND_URL}/api/v1/account${path}`, {
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

/** A linked social identity owned by the current user. */
export interface LinkedSocial {
  provider: string;
  email: string;
  createdAt: string;
}

/** Lists the current user's linked social identities. */
export async function listLinkedSocials(): Promise<LinkedSocial[]> {
  const data = await accountRequest<{ socials: LinkedSocial[] }>('/social');
  return data.socials;
}

/** Unlinks a social identity from the current user. */
export async function unlinkSocial(provider: string): Promise<void> {
  await accountRequest<void>(`/social/${encodeURIComponent(provider)}`, {
    method: 'DELETE',
  });
}

/** Changes (or initially sets) the current user's password. */
export async function changePassword(input: {
  currentPassword?: string;
  newPassword: string;
}): Promise<void> {
  await accountRequest<void>('/password', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** Requests an email change (sends a code to the new address). */
export async function requestEmailChange(newEmail: string): Promise<{ email: string }> {
  return accountRequest<{ email: string }>('/email/request', {
    method: 'POST',
    body: JSON.stringify({ newEmail }),
  });
}

/** Confirms an email change with the emailed code. */
export async function confirmEmailChange(code: string): Promise<{ email: string }> {
  return accountRequest<{ email: string }>('/email/confirm', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}
