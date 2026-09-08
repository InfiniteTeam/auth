'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AuthShell } from '@/components/AuthShell';

interface KratosError {
  id: string;
  code: number;
  status: string;
  message: string;
  reason?: string;
  debug?: string;
}

export default function ErrorPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const message = searchParams.get('message');
  const [error, setError] = useState<KratosError | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/.kratos/self-service/errors?id=${id}`)
      .then((r) => r.json())
      .then((data) => setError(data))
      .catch(() => {});
  }, [id]);

  return (
    <AuthShell requestLabel="요청 오류" requestName="인증을 완료하지 못했습니다">
      <div className="card-heading">
        <p>문제가 발생했습니다</p>
        <h1>인증 요청을 처리할 수 없어요</h1>
        <span>{message || error?.message || '잠시 후 다시 시도해 주세요.'}</span>
      </div>
      {error?.reason ? <p className="error-detail">{error.reason}</p> : null}
      <div className="inline-actions">
        <Link className="btn btn-primary" href="/login">로그인으로 돌아가기</Link>
      </div>
    </AuthShell>
  );
}
