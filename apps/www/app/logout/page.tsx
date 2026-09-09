'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useSignOut } from '@inft/auth-core/react';
import { AuthShell } from '@/components/AuthShell';
import { BACKEND_URL } from '@/lib/auth';

function LogoutFlow() {
  const searchParams = useSearchParams();
  const { signOut } = useSignOut(BACKEND_URL);
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) {
      return;
    }
    started.current = true;
    signOut()
      .catch(() => setFailed(true))
      .finally(() => {
        const target = searchParams.get('return_to');
        window.location.href = target?.startsWith('/') ? target : '/';
      });
  }, [searchParams, signOut]);

  return (
    <AuthShell requestLabel="로그아웃" requestName="Infinite Studio 계정">
      <div className="card-heading">
        <p>계정 보안</p>
        <h1>{failed ? '다시 시도해 주세요' : '로그아웃 중입니다'}</h1>
        <span>{failed ? '로그아웃 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.' : '곧 첫 화면으로 이동합니다.'}</span>
      </div>
      <div className="flow-loading" role="status">
        <span className="spinner" />
        {failed ? '뒤로 이동 중…' : '세션을 정리하는 중입니다.'}
      </div>
    </AuthShell>
  );
}

export default function LogoutPage() {
  return (
    <Suspense
      fallback={
        <AuthShell requestLabel="로그아웃" requestName="Infinite Studio 계정">
          <div className="flow-loading" role="status">
            <span className="spinner" />
            세션을 정리하는 중입니다.
          </div>
        </AuthShell>
      }
    >
      <LogoutFlow />
    </Suspense>
  );
}