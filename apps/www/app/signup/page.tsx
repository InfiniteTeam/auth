'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { useSignIn } from '@inftkr/auth-core/react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AuthShell } from '@/components/AuthShell';
import { Button } from '@/components/ui/button';
import { BACKEND_URL } from '@/lib/auth';

type SocialProvider = 'github' | 'discord';

function SignupForm() {
  const { signInSocial, isLoading } = useSignIn(BACKEND_URL);
  const [error, setError] = useState<string | null>(null);
  const [socialPending, setSocialPending] = useState<SocialProvider | null>(null);

  const onSocial = useCallback(
    async (provider: SocialProvider) => {
      setError(null);
      setSocialPending(provider);
      try {
        await signInSocial(provider);
      } catch {
        setError('소셜 가입을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      } finally {
        setSocialPending(null);
      }
    },
    [signInSocial],
  );

  return (
    <AuthShell requestLabel="계정 만들기" requestName="Infinite Studio 계정">
      <div className="card-heading">
        <p>회원가입</p>
        <h1>계정 만들기</h1>
        <span>Infinite Studio 계정으로 모든 서비스를 더 편리하게 이용하세요.</span>
      </div>

      {error ? (
        <Alert variant="destructive" className="mt-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="mt-8 flex flex-col gap-3">
        <Button
          variant="outline"
          size="lg"
          disabled={isLoading || !!socialPending}
          onClick={() => onSocial('github')}
        >
          {socialPending === 'github' ? 'GitHub 연결 중…' : 'GitHub로 계정 만들기'}
        </Button>
        <Button
          variant="outline"
          size="lg"
          disabled={isLoading || !!socialPending}
          onClick={() => onSocial('discord')}
        >
          {socialPending === 'discord' ? 'Discord 연결 중…' : 'Discord로 계정 만들기'}
        </Button>
      </div>

      <div className="messages mt-6">
        <p className="message message-info">
          조직 구성원은 GitHub 또는 Discord로 바로 가입할 수 있습니다. 그 외 이메일로
          가입하는 경우 안내된 인증 이메일로 본인 확인을 거칩니다.
        </p>
      </div>

      <p className="account-note">
        이미 계정이 있으신가요? <Link href="/login">로그인</Link>
      </p>
    </AuthShell>
  );
}

export default function SignupPage() {
  return <SignupForm />;
}