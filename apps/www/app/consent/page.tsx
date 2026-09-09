import Link from 'next/link';
import type { Metadata } from 'next';
import { AuthShell } from '@/components/AuthShell';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: '권한 요청 · Infinite Studio SSO',
};

type PageProps = {
  searchParams: Promise<{
    consent_challenge?: string;
  }>;
};

export default async function ConsentPage({ searchParams }: PageProps) {
  const { consent_challenge: challenge } = await searchParams;

  return (
    <AuthShell requestLabel="권한 요청" requestName="연결 서비스">
      <div className="card-heading">
        <p>권한 확인</p>
        <h1>연결하기</h1>
        <span>서비스가 요청한 정보를 확인하고 동의해 주세요.</span>
      </div>
      <div className="messages">
        <p className="message message-info">
          {challenge
            ? '이 요청은 아직 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.'
            : '권한 심사 요청이 올바르지 않습니다. 처음부터 다시 시도해 주세요.'}
        </p>
      </div>
      <div className="inline-actions">
        <Button size="lg" variant="outline" render={<Link href="/" />}>
          계정 홈으로 돌아가기
        </Button>
      </div>
    </AuthShell>
  );
}