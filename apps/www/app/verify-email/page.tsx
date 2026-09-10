'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSocialVerification } from '@inftkr/auth-core/react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AuthShell } from '@/components/AuthShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BACKEND_URL } from '@/lib/auth';

const PROVIDER_LABEL: Record<string, string> = {
  github: 'GitHub',
  discord: 'Discord',
};

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const account = searchParams.get('account') ?? '';
  const provider = searchParams.get('provider') ?? '';
  const linkError = searchParams.get('error');

  const { verify, resend, isLoading, error } = useSocialVerification(BACKEND_URL);
  const [code, setCode] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [sent, setSent] = useState(false);
  const [resendTtl, setResendTtl] = useState(30);
  const [submitting, setSubmitting] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (resendTtl > 0) {
      timer.current = setInterval(() => setResendTtl((value) => value - 1), 1000);
      return () => {
        if (timer.current) {
          clearInterval(timer.current);
        }
      };
    }
    if (timer.current) {
      clearInterval(timer.current);
    }
  }, [resendTtl]);

  const onSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!account) {
        setInvalid(true);
        return;
      }
      setSubmitting(true);
      const session = await verify(account, code.trim());
      setSubmitting(false);
      if (session) {
        router.replace('/');
      }
    },
    [account, code, router, verify],
  );

  const onResend = useCallback(async () => {
    if (!account) {
      setInvalid(true);
      return;
    }
    setResendTtl(30);
    const ok = await resend(account);
    if (ok) {
      setSent(true);
    }
  }, [account, resend]);

  const emailLabel = PROVIDER_LABEL[provider] ?? '소셜';

  return (
    <AuthShell requestLabel="이메일 확인" requestName="Infinite Studio 계정">
      <div className="card-heading">
        <p>계정 생성 완료를 앞두고 있어요</p>
        <h1>이메일 주소를 확인해 주세요</h1>
        <span>{emailLabel} 로그인으로 계정을 만드는 마지막 단계입니다.</span>
      </div>

      {invalid || !account ? (
        <Alert variant="destructive" className="mt-6">
          <AlertDescription>이메일 확인 요청이 올바르지 않습니다. 처음부터 다시 시도해 주세요.</AlertDescription>
        </Alert>
      ) : null}

      {linkError === 'invalid' ? (
        <Alert variant="destructive" className="mt-6">
          <AlertDescription>인증 링크가 만료되었거나 유효하지 않습니다. 아래에서 코드를 다시 요청해 주세요.</AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive" className="mt-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {sent ? (
        <Alert className="mt-6">
          <AlertDescription>새 인증 코드가 이메일로 발송되었습니다.</AlertDescription>
        </Alert>
      ) : null}

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="code">인증 코드</Label>
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="000000"
            maxLength={6}
            className="h-11 font-mono text-center text-lg tracking-[0.5em]"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
          />
        </div>
        <Button type="submit" size="lg" disabled={isLoading || submitting || code.length !== 6}>
          {submitting ? '확인 중…' : '이메일 확인'}
        </Button>
      </form>

      <div className="mt-4 flex flex-col items-center gap-1 text-sm text-muted-foreground">
        <button
          type="button"
          className="text-sm font-medium text-primary underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onResend}
          disabled={isLoading || resendTtl > 0}
        >
          인증 코드가 오지 않았나요?
        </button>
        {resendTtl > 0 ? <span>({resendTtl}초 후 다시 보낼 수 있어요)</span> : null}
      </div>

      <p className="account-note">
        문제가 계속되면 <Link href="/login">로그인</Link>으로 돌아가 새로 시도해 주세요.
      </p>
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <AuthShell requestLabel="이메일 확인" requestName="Infinite Studio 계정">
          <div className="flow-loading" role="status">
            <span className="spinner" />
            준비 중입니다.
          </div>
        </AuthShell>
      }
    >
      <VerifyEmailForm />
    </Suspense>
  );
}