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
import { AuthShell } from '@/components/AuthShell';

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
  const clientName = consentRequest.client?.client_name || consentRequest.client?.client_id || '연결 서비스';
  const scopeCopy: Record<string, { title: string; description: string }> = {
    openid: { title: '계정 식별', description: '서비스에서 내 Infinite Studio 계정을 확인합니다.' },
    email: { title: '이메일 주소', description: '계정 이메일과 인증 여부를 확인합니다.' },
    profile: { title: '기본 프로필', description: '이름과 사용자 표시 정보를 확인합니다.' },
    groups: { title: '소속 그룹', description: '서비스 접근에 필요한 그룹 정보를 확인합니다.' },
    role: { title: '계정 권한', description: '허용된 기능을 결정하기 위한 역할을 확인합니다.' },
    offline: { title: '오프라인 접근', description: '로그인 세션이 끝난 뒤에도 허용된 연결을 유지합니다.' },
    offline_access: { title: '오프라인 접근', description: '로그인 세션이 끝난 뒤에도 허용된 연결을 유지합니다.' },
  };

  return (
    <AuthShell requestLabel="권한 요청" requestName={clientName}>
      <div className="card-heading">
        <p>권한 확인</p>
        <h1>{clientName}에 연결</h1>
        <span>서비스가 요청한 정보만 확인하고 동의해 주세요.</span>
      </div>

      {scopes.length > 0 ? (
        <div className="permission-list" aria-label="요청 권한">
          {scopes.map((scope) => {
            const copy = scopeCopy[scope] || {
              title: scope,
              description: '서비스가 요청한 추가 권한입니다.',
            };
            return (
              <div className="permission-item" key={scope}>
                <b className="permission-icon">{scope.slice(0, 2)}</b>
                <span className="permission-copy">
                  <strong>{copy.title}</strong>
                  <small>{copy.description}</small>
                </span>
                <span className="permission-check" aria-hidden="true">✓</span>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="consent-actions">
          <form method="POST" action="/oauth2/consent/action">
            <input type="hidden" name="challenge" value={challenge} />
            <button
              type="submit"
              name="grant"
              value="accept"
              className="btn btn-primary"
            >
              동의하고 계속
            </button>
          </form>
          <form method="POST" action="/oauth2/consent/action">
            <input type="hidden" name="challenge" value={challenge} />
            <button
              type="submit"
              name="grant"
              value="deny"
              className="btn btn-outline"
            >
              취소
            </button>
          </form>
      </div>
    </AuthShell>
  );
}
