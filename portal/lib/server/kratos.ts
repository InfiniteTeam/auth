import { cookies } from 'next/headers';
import { serverEnv } from './config';

export type SessionIdentity = {
  id: string;
  traits: {
    email: string;
    name?: { first?: string; last?: string };
    role?: string;
    groups?: string[];
  };
  credentials?: Record<string, unknown>;
};

export type Session = {
  id: string;
  active: boolean;
  identity: SessionIdentity;
  expires_at?: string;
};

export async function fetchSession(): Promise<Session | null> {
  const { kratosPublicUrl } = serverEnv();
  const cookieStore = await cookies();
  const cookie = cookieStore.toString();

  const res = await fetch(`${kratosPublicUrl}/sessions/whoami`, {
    headers: {
      cookie,
      accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    return null;
  }

  return (await res.json()) as Session;
}

export async function fetchLogoutUrl(): Promise<string | null> {
  const { kratosPublicUrl } = serverEnv();
  const cookieStore = await cookies();
  const cookie = cookieStore.toString();

  const res = await fetch(`${kratosPublicUrl}/self-service/logout/browser`, {
    headers: {
      cookie,
      accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    return null;
  }

  const data = (await res.json()) as { logout_url?: string };
  return data.logout_url ?? null;
}

export async function fetchIdentityById(id: string): Promise<SessionIdentity | null> {
  const { kratosAdminUrl } = serverEnv();

  const res = await fetch(`${kratosAdminUrl}/admin/identities/${id}`, {
    headers: {
      accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    return null;
  }

  return (await res.json()) as SessionIdentity;
}