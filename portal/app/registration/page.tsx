'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Flow } from '@/components/Flow';
import { AuthShell } from '@/components/AuthShell';
import { useHandleGetFlowError } from '@/lib/flow-errors';
import { frontendApi, RegistrationFlow } from '@/lib/sdk';

const HIDDEN_REGISTRATION_FIELDS = [
  'id',
  'credentials.password.type',
  'credentials.oidc.identifiers',
  'credentials.oidc.type',
  'credentials.oidc.version',
  'schema_id',
  'state',
  'state_changed_at',
  'created_at',
  'updated_at',
  'traits.groups',
  'traits.role',
];

export default function RegistrationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [flow, setFlow] = useState<RegistrationFlow>();

  const returnTo = searchParams.get('return_to');
  const flowId = searchParams.get('flow');

  const resetFlow = useCallback(() => setFlow(undefined), []);
  const handleFlowError = useHandleGetFlowError('registration', resetFlow);

  useEffect(() => {
    if (flow) return;

    if (flowId) {
      frontendApi.getRegistrationFlow({ id: flowId })
        .then(({ data }) => setFlow(data))
        .catch(handleFlowError);
      return;
    }

    frontendApi.createBrowserRegistrationFlow({
      returnTo: returnTo || undefined,
    })
      .then(({ data }) => setFlow(data))
      .catch(handleFlowError);
  }, [flowId, returnTo, flow, handleFlowError]);

  const onSubmit = useCallback(
    async (values: Record<string, unknown>) => {
      const body = values as any;
      router.push(`/registration?flow=${flow?.id}`, { scroll: false });
      try {
        await frontendApi.updateRegistrationFlow({
          flow: String(flow?.id),
          updateRegistrationFlowBody: body,
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

  return (
    <AuthShell requestLabel="새 계정" requestName="Infinite Studio 가입">
      <div className="card-heading">
        <p>시작하기</p>
        <h1>계정 만들기</h1>
        <span>하나의 계정으로 Infinite Studio의 모든 서비스를 이용하세요.</span>
      </div>

      <Flow
        flow={flow}
        exclude={HIDDEN_REGISTRATION_FIELDS}
        onSubmit={onSubmit}
      />

      <p className="account-note">
        이미 계정이 있으신가요? <Link href="/login">로그인</Link>
      </p>
    </AuthShell>
  );
}
