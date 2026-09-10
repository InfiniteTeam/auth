'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { AuthShell } from '@/components/AuthShell';
import { Button } from '@/components/ui/button';

const PROVIDER_LABEL: Record<string, string> = {
  github: 'GitHub',
  discord: 'Discord',
};

const ERROR_MESSAGE: Record<string, string> = {
  provider_disabled: '이 소셜 로그인은 현재 사용할 수 없습니다.',
  invalid_state: '로그인 요청이 만료되었거나 유효하지 않습니다. 처음부터 다시 시도해 주세요.',
  provider_error: '소셜 로그인 처리 중 문제가 발생했습니다.',
  already_linked: '이 소셜 계정은 이미 다른 inft 계정에 연결되어 있습니다.',
  membership_required: '이 기능은 승인된 조직 또는 서버 구성원만 사용할 수 있습니다.',
  email_exists: '이미 같은 이메일로 가입된 계정이 있습니다. LDAP 로그인을 이용해 주세요.',
  email_domain_not_allowed: '허용되지 않은 이메일 도메인입니다. inft.kr 이메일로 가입해 주세요.',
  verification_unavailable: '이메일 인증 서비스가 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.',
};

function SocialErrorContent() {
  const searchParams = useSearchParams();
  const provider = searchParams.get('provider') ?? '';
  const error = searchParams.get('error') ?? '';
  const providerLabel = PROVIDER_LABEL[provider] ?? (provider || '소셜');
  const message = ERROR_MESSAGE[error] ?? '소셜 로그인 처리 중 문제가 발생했습니다.';

  return (
    <AuthShell requestLabel="로그인 실패" requestName="Infinite Studio 계정">
      <div className="card-heading">
        <p>잠깐, 문제가 발생했어요</p>
        <h1>{providerLabel} 로그인을 완료하지 못했습니다</h1>
        <span>{message}</span>
      </div>
      <div className="inline-actions">
        <Button size="lg" render={<Link href="/login" />}>
          로그인으로 돌아가기
        </Button>
        <Button size="lg" variant="outline" render={<Link href="/" />}>
          계정 홈
        </Button>
      </div>
    </AuthShell>
  );
}

export default function SocialErrorPage() {
  return (
    <Suspense
      fallback={
        <AuthShell requestLabel="로그인 실패" requestName="Infinite Studio 계정">
          <div className="flow-loading" role="status">
            <span className="spinner" />
            준비 중입니다.
          </div>
        </AuthShell>
      }
    >
      <SocialErrorContent />
    </Suspense>
  );
}