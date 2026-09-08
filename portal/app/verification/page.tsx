'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Flow } from '@/components/Flow';
import { AuthShell } from '@/components/AuthShell';
import { useHandleGetFlowError } from '@/lib/flow-errors';
import { frontendApi, VerificationFlow } from '@/lib/sdk';

export default function VerificationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [flow, setFlow] = useState<VerificationFlow>();

  const flowId = searchParams.get('flow');

  const resetFlow = useCallback(() => setFlow(undefined), []);
  const handleFlowError = useHandleGetFlowError('verification', resetFlow);

  useEffect(() => {
    if (flow) return;

    if (flowId) {
      frontendApi.getVerificationFlow({ id: flowId })
        .then(({ data }) => setFlow(data))
        .catch(handleFlowError);
      return;
    }

    frontendApi.createBrowserVerificationFlow()
      .then(({ data }) => setFlow(data))
        .catch(handleFlowError);
  }, [flowId, flow, handleFlowError]);

  const onSubmit = useCallback(
    async (values: Record<string, unknown>) => {
      const body = values as any;
      router.push(`/verification?flow=${flow?.id}`, { scroll: false });
      try {
        const { data } = await frontendApi.updateVerificationFlow({
          flow: String(flow?.id),
          updateVerificationFlowBody: body,
        });
        setFlow((prev) => (prev ? { ...prev, ui: data.ui, state: data.state } : data));
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

  return (
    <AuthShell requestLabel="이메일 확인" requestName="계정 인증">
      <div className="card-heading">
        <p>이메일 인증</p>
        <h1>이메일을 확인해 주세요</h1>
        <span>인증 메일을 받을 주소 또는 전달받은 인증 코드를 입력하세요.</span>
      </div>

      <Flow flow={flow} onSubmit={onSubmit} />

      <p className="account-note"><Link href="/login">로그인으로 돌아가기</Link></p>
    </AuthShell>
  );
}
