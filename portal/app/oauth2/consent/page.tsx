import { redirect } from 'next/navigation';
import {
  acceptHydraConsentRequest,
  buildConsentSession,
  getHydraConsentRequest,
  rejectHydraConsentRequest,
} from '@/lib/server/hydra';
import { getDiscordGuildFromIdentity } from '@/lib/server/discord';
import { fetchIdentityById } from '@/lib/server/kratos';
import { serverEnv } from '@/lib/server/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams: Promise<{ consent_challenge?: string }>;
};

export default async function ConsentPage({ searchParams }: PageProps) {
  const { consent_challenge: challenge } = await searchParams;

  if (!challenge) {
    redirect(`/error?message=Missing%20consent_challenge`);
  }

  let consentRequest;
  try {
    consentRequest = await getHydraConsentRequest(challenge);
  } catch {
    redirect(`/error?message=Consent%20request%20could%20not%20be%20loaded`);
  }

  if (consentRequest.skip && consentRequest.subject) {
    const identity = await fetchIdentityById(consentRequest.subject);
    const fallbackIdentity = { id: consentRequest.subject, traits: { email: '' } };
    const discordGuild = await getDiscordGuildFromIdentity(identity || fallbackIdentity);

    const { discordGuildId } = serverEnv();
    if (discordGuildId && !discordGuild.member) {
      const rejected = await rejectHydraConsentRequest(challenge, 'access_denied', 'You must be a member of the designated Discord server.');
      redirect(rejected.redirect_to);
    }

    const session = buildConsentSession(identity || fallbackIdentity, discordGuild, consentRequest.requested_scope || []);
    try {
      const result = await acceptHydraConsentRequest(challenge, consentRequest.requested_scope || [], session, true);
      redirect(result.redirect_to);
    } catch {
      redirect(`/error?message=Consent%20could%20not%20be%20accepted`);
    }
  }

  const scopes = consentRequest.requested_scope || [];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div
        className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 w-full"
        style={{ maxWidth: '480px' }}
      >
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Authorization Request</h1>
        <p className="text-gray-600 mb-6">
          <strong>{consentRequest.client?.client_name || consentRequest.client?.client_id || 'An application'}</strong>{' '}
          is requesting access to your account.
        </p>

        {scopes.length > 0 ? (
          <div className="mb-6">
            <p className="text-sm font-medium text-gray-700 mb-2">This will allow the application to:</p>
            <ul className="space-y-1">
              {scopes.map((scope) => (
                <li key={scope} className="text-sm text-gray-600">
                  <span className="text-emerald-600 mr-1">✓</span>
                  <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{scope}</code>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex gap-3">
          <form method="POST" action="/oauth2/consent/action" className="flex-1">
            <input type="hidden" name="challenge" value={challenge} />
            <button
              type="submit"
              name="grant"
              value="accept"
              className="w-full rounded-md bg-emerald-600 px-4 py-2 text-white text-sm font-medium hover:bg-emerald-700"
            >
              Allow
            </button>
          </form>
          <form method="POST" action="/oauth2/consent/action" className="flex-1">
            <input type="hidden" name="challenge" value={challenge} />
            <button
              type="submit"
              name="grant"
              value="deny"
              className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-700 text-sm font-medium hover:bg-gray-50"
            >
              Deny
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}