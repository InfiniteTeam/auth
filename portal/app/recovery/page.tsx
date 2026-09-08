'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Flow } from '@/components/Flow';
import { AuthShell } from '@/components/AuthShell';
import { useHandleGetFlowError } from '@/lib/flow-errors';
import { frontendApi, RecoveryFlow } from '@/lib/sdk';

export default function RecoveryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [flow, setFlow] = useState<RecoveryFlow>();

  const flowId = searchParams.get('flow');

  const resetFlow = useCallback(() => setFlow(undefined), []);
  const handleFlowError = useHandleGetFlowError('recovery', resetFlow);

  useEffect(() => {
    if (flow) return;

    if (flowId) {
      frontendApi.getRecoveryFlow({ id: flowId })
        .then(({ data }) => setFlow(data))
        .catch(handleFlowError);
      return;
    }

    frontendApi.createBrowserRecoveryFlow()
      .then(({ data }) => setFlow(data))
      .catch(handleFlowError);
  }, [flowId, flow, handleFlowError]);

  const onSubmit = useCallback(
    async (values: Record<string, unknown>) => {
      const body = values as any;
      router.push(`/recovery?flow=${flow?.id}`, { scroll: false });
      try {
        const { data } = await frontendApi.updateRecoveryFlow({
          flow: String(flow?.id),
          updateRecoveryFlowBody: body,
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
    <AuthShell requestLabel="계정 복구" requestName="비밀번호 재설정">
      <div className="card-heading">
        <p>계정 복구</p>
        <h1>비밀번호를 잊으셨나요?</h1>
        <span>가입한 이메일을 입력하면 계정 복구 방법을 안내해 드립니다.</span>
      </div>

      <Flow flow={flow} onSubmit={onSubmit} />

      <p className="account-note"><Link href="/login">로그인으로 돌아가기</Link></p>
    </AuthShell>
  );
}
