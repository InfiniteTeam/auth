'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Flow, Methods } from '@/components/Flow';
import { AuthShell } from '@/components/AuthShell';
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
    { id: 'profile', label: '프로필' },
    { id: 'password', label: '비밀번호' },
    { id: 'oidc', label: '연결 계정' },
    { id: 'totp', label: '인증 앱' },
    { id: 'webauthn', label: '보안 키' },
    { id: 'lookup_secret', label: '복구 코드' },
  ];

  const availableGroups = new Set<string>(flow?.ui.nodes.map((n) => n.group) || []);

  return (
    <AuthShell requestLabel="계정 관리" requestName="보안 및 프로필 설정" wide>
      <div className="card-heading">
        <p>내 계정</p>
        <h1>계정 설정</h1>
        <span>프로필, 로그인 수단과 복구 정보를 안전하게 관리하세요.</span>
      </div>

      {flow ? (
        <>
          <div className="settings-tabs" role="tablist" aria-label="계정 설정">
            {tabs.map((tab) =>
              availableGroups.has(tab.id) || tab.id === 'profile' ? (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  className={`btn ${activeTab === tab.id ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ) : null
            )}
          </div>
          <Flow flow={flow} only={[activeTab]} onSubmit={onSubmit} />
        </>
      ) : <div className="flow-loading" role="status"><span className="spinner" />계정 정보를 불러오는 중입니다.</div>}

      <p className="account-note"><Link href="/">계정 홈으로 돌아가기</Link></p>
    </AuthShell>
  );
}
