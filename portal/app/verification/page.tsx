'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Flow } from '@/components/Flow';
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
    <main className="container">
      <div className="card">
        <h1>Verify Email</h1>
        <p className="subtitle">Confirm your email address</p>

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