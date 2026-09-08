import { NextResponse } from 'next/server';
import {
  acceptHydraConsentRequest,
  buildConsentSession,
  getHydraConsentRequest,
  rejectHydraConsentRequest,
} from '@/lib/server/hydra';
import { getDiscordGuildFromIdentity } from '@/lib/server/discord';
import { fetchIdentityById, fetchSession } from '@/lib/server/kratos';
import { serverEnv } from '@/lib/server/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const formData = await request.formData();
  const challenge = String(formData.get('challenge') || '');
  const grant = String(formData.get('grant') || '');
  const selfUrl = process.env.SELF_URL || '';

  if (!challenge) {
    return NextResponse.redirect(`${selfUrl}/error?message=Missing%20challenge`);
  }

  try {
    if (grant !== 'accept') {
      const rejected = await rejectHydraConsentRequest(challenge);
      return NextResponse.redirect(rejected.redirect_to);
    }

    const session = await fetchSession();
    const identityId = session?.identity?.id;
    if (!identityId) {
      const rejected = await rejectHydraConsentRequest(challenge);
      return NextResponse.redirect(rejected.redirect_to);
    }

    const consentRequest = await getHydraConsentRequest(challenge);
    const identity = await fetchIdentityById(identityId);
    const discordGuild = await getDiscordGuildFromIdentity(
      identity || { id: identityId, traits: { email: '' } }
    );

    const { discordGuildId } = serverEnv();
    if (discordGuildId && !discordGuild.member) {
      const rejected = await rejectHydraConsentRequest(challenge, 'access_denied', 'You must be a member of the designated Discord server.');
      return NextResponse.redirect(rejected.redirect_to);
    }

    const scopes = consentRequest.requested_scope || [];
    const consentSession = buildConsentSession(
      identity || { id: identityId, traits: { email: '' } },
      discordGuild,
      scopes
    );

    const accepted = await acceptHydraConsentRequest(challenge, scopes, consentSession, true);
    return NextResponse.redirect(accepted.redirect_to);
  } catch {
    return NextResponse.redirect(`${selfUrl}/error?message=Consent%20failed`);
  }
}