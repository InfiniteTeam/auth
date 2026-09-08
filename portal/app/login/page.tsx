'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Flow } from '@/components/Flow';
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

  return (
    <main className="container">
      <div className="card">
        <h1>
          {aal ? 'Two-Factor Authentication' : 'Sign In'}
        </h1>
        <p className="subtitle">
          {flow?.refresh ? 'Confirm Action' : 'Sign in to your account'}
        </p>

        <Flow
          flow={flow}
          onSubmit={onSubmit}
        />
      </div>

      {(aal || refresh) && logoutUrl && (
        <div className="card">
          <a className="btn btn-danger" href={logoutUrl}>
            Sign Out
          </a>
        </div>
      )}

      {!aal && !refresh && (
        <div className="card" style={{ display: 'flex', gap: '0.5rem' }}>
          <Link className="btn btn-outline" href="/registration">
            Create Account
          </Link>
          <Link className="btn btn-outline" href="/recovery">
            Recover Account
          </Link>
        </div>
      )}
    </main>
  );
}