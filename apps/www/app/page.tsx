'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useSession } from '@inftkr/auth-core/react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AuthShell } from '@/components/AuthShell';
import { Button } from '@/components/ui/button';
import { BACKEND_URL } from '@/lib/auth';

function SocialNotice() {
  const searchParams = useSearchParams();
  if (searchParams.get('social') !== 'ok') {
    return null;
  }
  return (
    <Alert className="mt-6">
      <AlertDescription>소셜 계정으로 성공적으로 로그인했습니다.</AlertDescription>
    </Alert>
  );
}

function HomePage() {
  const { session, isLoading } = useSession({ baseUrl: BACKEND_URL });

  if (isLoading) {
    return (
      <AuthShell requestLabel="로그인됨" requestName="Infinite Studio 계정">
        <div className="flow-loading" role="status">
          <span className="spinner" />
          계정 정보를 불러오는 중입니다.
        </div>
      </AuthShell>
    );
  }

  if (!session) {
    return (
      <AuthShell requestLabel="INFINITE STUDIO IDENTITY" requestName="통합 인증 포털">
        <div className="card-heading">
          <p>계정으로 계속하기</p>
          <h1>Infinite Studio에 오신 것을 환영합니다</h1>
          <span>로그인하면 연결된 서비스와 계정 설정을 안전하게 이용할 수 있습니다.</span>
        </div>
        <div className="inline-actions">
          <Button size="lg" render={<Link href="/login" />}>
            로그인
          </Button>
          <Button size="lg" variant="outline" render={<Link href="/signup" />}>
            계정 만들기
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell requestLabel="로그인됨" requestName="Infinite Studio 계정">
      <div className="card-heading">
        <p>계정 홈</p>
        <h1>안녕하세요</h1>
        <span>현재 안전하게 로그인되어 있습니다.</span>
      </div>
      <SocialNotice />
      <div className="profile-card">
        <p>로그인 계정</p>
        <strong>{session.user.email}</strong>
        <div className="profile-meta">권한 · {session.user.roles.join(', ') || 'user'}</div>
      </div>
      <div className="inline-actions">
        <Button size="lg" render={<Link href="/settings" />}>
          계정 설정
        </Button>
        <Button size="lg" variant="destructive" render={<Link href="/logout" />}>
          로그아웃
        </Button>
      </div>
    </AuthShell>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <AuthShell requestLabel="로그인됨" requestName="Infinite Studio 계정">
          <div className="flow-loading" role="status">
            <span className="spinner" />
            계정 정보를 불러오는 중입니다.
          </div>
        </AuthShell>
      }
    >
      <HomePage />
    </Suspense>
  );
}