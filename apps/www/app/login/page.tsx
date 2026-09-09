'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AuthApiError } from '@inftkr/auth-core';
import { useSignIn } from '@inftkr/auth-core/react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AuthShell } from '@/components/AuthShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BACKEND_URL } from '@/lib/auth';

const loginSchema = z.object({
  email: z.string().email('올바른 이메일 주소를 입력해 주세요.'),
  password: z.string().min(1, '비밀번호를 입력해 주세요.'),
});

type LoginValues = z.infer<typeof loginSchema>;

type SocialProvider = 'github' | 'discord';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signInLdap, signInSocial, isLoading } = useSignIn(BACKEND_URL);
  const [error, setError] = useState<string | null>(null);
  const [socialPending, setSocialPending] = useState<SocialProvider | null>(null);

  const returnTo = searchParams.get('return_to');

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = useCallback(
    async (values: LoginValues) => {
      setError(null);
      try {
        await signInLdap(values.email, values.password);
        const target = returnTo?.startsWith('/') ? returnTo : '/';
        window.location.href = target;
      } catch (err) {
        setError(
          err instanceof AuthApiError
            ? '이메일 또는 비밀번호가 올바르지 않습니다.'
            : '로그인 중 문제가 발생했습니다.',
        );
      }
    },
    [returnTo, signInLdap],
  );

  const onSocial = useCallback(
    async (provider: SocialProvider) => {
      setError(null);
      setSocialPending(provider);
      try {
        await signInSocial(provider);
      } catch {
        setError('소셜 로그인은 준비 중입니다.');
      } finally {
        setSocialPending(null);
      }
    },
    [signInSocial],
  );

  return (
    <AuthShell requestLabel="로그인 요청" requestName="Infinite Studio 계정">
      <div className="card-heading">
        <p>다시 만나 반가워요</p>
        <h1>계정에 로그인</h1>
        <span>Infinite Studio 계정으로 계속합니다.</span>
      </div>

      {error ? (
        <Alert variant="destructive" className="mt-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">이메일</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@inftkr.kr"
            className="h-11"
            {...form.register('email')}
          />
          {form.formState.errors.email ? (
            <p className="text-sm text-destructive" role="alert">
              {form.formState.errors.email.message}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">비밀번호</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            className="h-11"
            {...form.register('password')}
          />
          {form.formState.errors.password ? (
            <p className="text-sm text-destructive" role="alert">
              {form.formState.errors.password.message}
            </p>
          ) : null}
        </div>
        <Button type="submit" size="lg" disabled={isLoading || form.formState.isSubmitting}>
          {isLoading ? '로그인 중…' : '로그인'}
        </Button>
      </form>

      <div className="mt-6 flex flex-col gap-3">
        <Button variant="outline" size="lg" disabled={!!socialPending} onClick={() => onSocial('github')}>
          {socialPending === 'github' ? 'GitHub 연결 중…' : 'GitHub로 계속하기'}
        </Button>
        <Button variant="outline" size="lg" disabled={!!socialPending} onClick={() => onSocial('discord')}>
          {socialPending === 'discord' ? 'Discord 연결 중…' : 'Discord로 계속하기'}
        </Button>
      </div>

      <p className="account-note">
        계정이 없으신가요? <Link href="/signup">계정 만들기</Link>
      </p>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AuthShell requestLabel="로그인 요청" requestName="Infinite Studio 계정">
          <div className="flow-loading" role="status">
            <span className="spinner" />
            준비 중입니다.
          </div>
        </AuthShell>
      }
    >
      <LoginForm />
    </Suspense>
  );
}