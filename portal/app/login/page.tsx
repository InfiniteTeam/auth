'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Flow } from '@/components/Flow';
import { AuthShell } from '@/components/AuthShell';
import { useHandleGetFlowError } from '@/lib/flow-errors';
import { frontendApi, LoginFlow } from '@/lib/sdk';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [flow, setFlow] = useState<LoginFlow>();
  const [logoutUrl, setLogoutUrl] = useState<string | null>(null);

  const returnTo = searchParams.get('return_to');
  const flowId = searchParams.get('flow');
  const refresh = searchParams.get('refresh');
  const aal = searchParams.get('aal');

  const resetFlow = useCallback(() => setFlow(undefined), []);
  const handleFlowError = useHandleGetFlowError('login', resetFlow);

  useEffect(() => {
    if (flow) return;

    if (flowId) {
      frontendApi.getLoginFlow({ id: flowId })
        .then(({ data }) => setFlow(data))
        .catch(handleFlowError);
      return;
    }

    frontendApi.createBrowserLoginFlow({
      refresh: refresh === 'true',
      aal: aal || undefined,
      returnTo: returnTo || undefined,
    })
      .then(({ data }) => setFlow(data))
      .catch(handleFlowError);
  }, [flowId, refresh, aal, returnTo, flow, handleFlowError]);

  useEffect(() => {
    if (aal || refresh) {
      frontendApi.createBrowserLogoutFlow()
        .then(({ data }) => setLogoutUrl(data.logout_url))
        .catch(() => {});
    }
  }, [aal, refresh]);

  const onSubmit = useCallback(
    async (values: Record<string, unknown>) => {
      const body = values as any;
      router.push(`/login?flow=${flow?.id}`, { scroll: false });
      try {
        await frontendApi.updateLoginFlow({
          flow: String(flow?.id),
          updateLoginFlowBody: body,
        });
        if (flow?.return_to) {
          window.location.href = flow.return_to;
          return;
        }
        router.push('/');
      } catch (err: any) {
        if (err?.response?.status === 400) {
          setFlow(err.response.data);
          return;
        }
        handleFlowError(err);
      }
    },
    [flow, router, handleFlowError]
  );

  const title = aal ? '2단계 인증' : flow?.refresh ? '본인 확인' : '계정에 로그인';
  const description = aal
    ? '계정 보호를 위해 추가 인증을 완료해 주세요.'
    : flow?.refresh
      ? '중요한 작업을 계속하려면 다시 인증해 주세요.'
      : 'Infinite Studio 계정으로 계속합니다.';

  return (
    <AuthShell requestLabel="로그인 요청" requestName="Infinite Studio 계정">
      <div className="card-heading">
        <p>{aal ? '보안 확인' : '다시 만나 반가워요'}</p>
        <h1>{title}</h1>
        <span>{description}</span>
      </div>

      <Flow flow={flow} onSubmit={onSubmit} />

      {(aal || refresh) && logoutUrl ? (
        <div className="inline-actions">
          <a className="btn btn-danger" href={logoutUrl}>다른 계정으로 로그인</a>
        </div>
      ) : null}

      {!aal && !refresh ? (
        <p className="account-note">
          계정이 없으신가요? <Link href="/registration">계정 만들기</Link>
          {' · '}
          <Link href="/recovery">비밀번호 찾기</Link>
        </p>
      ) : null}
    </AuthShell>
  );
}
