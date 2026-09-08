'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Flow, Methods } from '@/components/Flow';
import { useHandleGetFlowError } from '@/lib/flow-errors';
import { frontendApi, SettingsFlow } from '@/lib/sdk';

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [flow, setFlow] = useState<SettingsFlow>();
  const [activeTab, setActiveTab] = useState<Methods>('profile');

  const returnTo = searchParams.get('return_to');
  const flowId = searchParams.get('flow');

  const resetFlow = useCallback(() => setFlow(undefined), []);
  const handleFlowError = useHandleGetFlowError('settings', resetFlow);

  useEffect(() => {
    if (flow) return;

    if (flowId) {
      frontendApi.getSettingsFlow({ id: flowId })
        .then(({ data }) => setFlow(data))
        .catch(handleFlowError);
      return;
    }

    frontendApi.createBrowserSettingsFlow({ returnTo: returnTo || undefined })
      .then(({ data }) => setFlow(data))
      .catch(handleFlowError);
  }, [flowId, returnTo, flow, handleFlowError]);

  const onSubmit = useCallback(
    async (values: Record<string, unknown>) => {
      const body = values as any;
      router.push(`/settings?flow=${flow?.id}`, { scroll: false });
      try {
        const { data } = await frontendApi.updateSettingsFlow({
          flow: String(flow?.id),
          updateSettingsFlowBody: body,
        });
        setFlow((prev) => (prev ? { ...prev, ui: data.ui } : data));
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

  const tabs: { id: Methods; label: string }[] = [
    { id: 'profile', label: 'Profile' },
    { id: 'password', label: 'Password' },
    { id: 'oidc', label: 'Connected Accounts' },
    { id: 'totp', label: 'Authenticator App' },
    { id: 'webauthn', label: 'Security Key' },
    { id: 'lookup_secret', label: 'Recovery Codes' },
  ];

  const availableGroups = new Set<string>(flow?.ui.nodes.map((n) => n.group) || []);

  return (
    <main className="container">
      <div className="card">
        <h1>Account Settings</h1>
        <p className="subtitle">Manage your account</p>

        {flow ? (
          <>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              {tabs.map((tab) =>
                availableGroups.has(tab.id) || tab.id === 'profile' ? (
                  <button
                    key={tab.id}
                    className={`btn ${activeTab === tab.id ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ) : null
              )}
            </div>

            <Flow
              flow={flow}
              only={[activeTab]}
              onSubmit={onSubmit}
            />
          </>
        ) : null}
      </div>

      <div className="card">
        <Link className="btn btn-outline" href="/">
          Back to Home
        </Link>
      </div>
    </main>
  );
}