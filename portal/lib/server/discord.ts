import { serverEnv } from './config';
import type { DiscordGuild, IdentityLike } from './hydra';

export async function checkDiscordGuildMembership(discordId?: string): Promise<DiscordGuild> {
  const { discordBotToken, discordGuildId } = serverEnv();
  if (!discordId || !discordBotToken || !discordGuildId) {
    return { member: false, roles: [] };
  }
  try {
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${discordGuildId}/members/${discordId}`,
      { headers: { Authorization: `Bot ${discordBotToken}` }, cache: 'no-store' }
    );
    if (res.status === 200) {
      const member = (await res.json()) as { roles?: string[] };
      return { member: true, roles: member.roles || [] };
    }
    if (res.status === 404) return { member: false, roles: [] };
    return { member: false, roles: [] };
  } catch {
    return { member: false, roles: [] };
  }
}

export async function getDiscordGuildFromIdentity(identity: IdentityLike): Promise<DiscordGuild> {
  const credentials = identity.credentials || {};
  for (const credential of Object.values(credentials)) {
    if (!credential || typeof credential !== 'object') continue;
    const cred = credential as { type?: string; config?: { providers?: unknown[] } };
    if (cred.type !== 'oidc') continue;
    const providers = (cred.config?.providers as { provider?: string; initial_access_token?: string }[]) || [];
    const providerMeta = providers.find((p) => p.provider === 'discord');
    if (providerMeta?.initial_access_token) {
      try {
        const meRes = await fetch('https://discord.com/api/v10/users/@me', {
          headers: { Authorization: `Bearer ${providerMeta.initial_access_token}` },
          cache: 'no-store',
        });
        if (meRes.ok) {
          const discordUser = (await meRes.json()) as { id?: string };
          return checkDiscordGuildMembership(discordUser.id);
        }
      } catch {
        // fall through
      }
    }
  }
  return { member: false, roles: [] };
}