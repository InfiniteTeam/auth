import { serverEnv } from './config';

export type HydraLoginRequest = {
  challenge: string;
  subject?: string;
  skip?: boolean;
  client?: Record<string, unknown>;
};

export type HydraConsentRequest = {
  challenge: string;
  subject?: string;
  skip?: boolean;
  client?: { client_id?: string; client_name?: string };
  requested_scope?: string[];
};

export type HydraLogoutRequest = {
  challenge: string;
  subject?: string;
  client?: Record<string, unknown>;
};

export type DiscordGuild = {
  member: boolean;
  roles: string[];
};

export type IdentityLike = {
  id: string;
  traits: {
    email: string;
    name?: { first?: string; last?: string };
    role?: string;
  };
  credentials?: Record<string, unknown>;
  verifiable_addresses?: { value?: string; verified?: boolean }[];
};

async function adminJson<T>(path: string, init?: RequestInit): Promise<T> {
  const { hydraAdminUrl } = serverEnv();
  const res = await fetch(`${hydraAdminUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`hydra admin request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function getHydraLoginRequest(loginChallenge: string): Promise<HydraLoginRequest> {
  return adminJson(`/admin/oauth2/auth/requests/login?login_challenge=${encodeURIComponent(loginChallenge)}`);
}

export async function acceptHydraLoginRequest(
  loginChallenge: string,
  subject: string,
  remember = false
): Promise<{ redirect_to: string }> {
  return adminJson(`/admin/oauth2/auth/requests/login/accept?login_challenge=${encodeURIComponent(loginChallenge)}`, {
    method: 'PUT',
    body: JSON.stringify({ subject, remember, remember_for: 86400 }),
  });
}

export async function getHydraConsentRequest(consentChallenge: string): Promise<HydraConsentRequest> {
  return adminJson(`/admin/oauth2/auth/requests/consent?consent_challenge=${encodeURIComponent(consentChallenge)}`);
}

export async function acceptHydraConsentRequest(
  consentChallenge: string,
  grantScopes: string[],
  session: Record<string, unknown>,
  remember = false
): Promise<{ redirect_to: string }> {
  return adminJson(
    `/admin/oauth2/auth/requests/consent/accept?consent_challenge=${encodeURIComponent(consentChallenge)}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        grant_scope: grantScopes,
        grant_access_token_audience: grantScopes,
        remember,
        remember_for: 86400,
        session,
      }),
    }
  );
}

export async function rejectHydraConsentRequest(
  consentChallenge: string,
  error = 'access_denied',
  errorDescription = 'The resource owner denied the request.'
): Promise<{ redirect_to: string }> {
  return adminJson(
    `/admin/oauth2/auth/requests/consent/reject?consent_challenge=${encodeURIComponent(consentChallenge)}`,
    {
      method: 'PUT',
      body: JSON.stringify({ error, error_description: errorDescription }),
    }
  );
}

export async function getHydraLogoutRequest(logoutChallenge: string): Promise<HydraLogoutRequest> {
  return adminJson(`/admin/oauth2/auth/requests/logout?logout_challenge=${encodeURIComponent(logoutChallenge)}`);
}

export async function acceptHydraLogoutRequest(logoutChallenge: string): Promise<{ redirect_to: string }> {
  return adminJson(
    `/admin/oauth2/auth/requests/logout/accept?logout_challenge=${encodeURIComponent(logoutChallenge)}`,
    { method: 'PUT' }
  );
}

export function buildConsentSession(
  identity: IdentityLike,
  discordGuild: DiscordGuild,
  grantScopes: string[]
): { id_token: Record<string, unknown>; access_token: Record<string, unknown> } {
  const { discordGuildId } = serverEnv();
  const idToken: Record<string, unknown> = {};
  const accessToken: Record<string, unknown> = {};

  if (grantScopes.includes('email')) {
    idToken.email = identity.traits.email;
    idToken.email_verified = (identity.verifiable_addresses || []).some(
      (v) => v.verified && v.value === identity.traits.email
    );
  }

  if (grantScopes.includes('profile')) {
    idToken.name =
      [identity.traits.name?.first, identity.traits.name?.last].filter(Boolean).join(' ') || identity.traits.email;
    idToken.preferred_username = identity.traits.email.split('@')[0];
  }

  if (grantScopes.includes('groups') && discordGuild.member) {
    let groups: string[] = [];
    if (discordGuildId) groups.push(discordGuildId);
    groups = groups.concat(discordGuild.roles.map((r) => `discord:${r}`));
    idToken.groups = groups;
    accessToken.groups = groups;
  }

  if (grantScopes.includes('role')) {
    const adminRoles = serverEnv().adminDiscordRoles;
    const isAdmin = identity.traits.role === 'admin' || discordGuild.roles.some((r) => adminRoles.includes(r));
    idToken.role = isAdmin ? 'admin' : 'user';
    accessToken.role = idToken.role;
  }

  return { id_token: idToken, access_token: accessToken };
}