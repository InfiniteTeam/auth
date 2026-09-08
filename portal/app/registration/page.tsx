'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Flow } from '@/components/Flow';
import { useHandleGetFlowError } from '@/lib/flow-errors';
import { frontendApi, RegistrationFlow } from '@/lib/sdk';

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
    <main className="container">
      <div className="card">
        <h1>Create Account</h1>
        <p className="subtitle">Sign up for Infiniteteam</p>

        <Flow
          flow={flow}
          onSubmit={onSubmit}
        />
      </div>

      <div className="card">
        <Link className="btn btn-outline" href="/login">
          Sign In
        </Link>
      </div>
    </main>
  );
}