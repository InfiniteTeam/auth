'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Flow } from '@/components/Flow';
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
    <main className="container">
      <div className="card">
        <h1>Recover Account</h1>
        <p className="subtitle">Enter your email to recover your account</p>

        <Flow
          flow={flow}
          onSubmit={onSubmit}
        />
      </div>

      <div className="card">
        <Link className="btn btn-outline" href="/login">
          Back to Sign In
        </Link>
      </div>
    </main>
  );
}