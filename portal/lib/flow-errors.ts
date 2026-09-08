import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

type FlowErrorResponse = {
  error?: { id?: string };
  redirect_browser_to: string;
};

export type FlowType = 'login' | 'registration' | 'settings' | 'recovery' | 'verification';

export function useHandleGetFlowError(
  flowType: FlowType,
  resetFlow: (v: undefined) => void
) {
  const router = useRouter();

  return useCallback(
    async (err: { response?: { status?: number; data?: FlowErrorResponse } }) => {
      const errorId = err.response?.data?.error?.id;

      switch (errorId) {
        case 'session_inactive':
          router.push('/login?return_to=' + window.location.href);
          return;
        case 'session_aal2_required': {
          const aal2Url = err.response?.data?.redirect_browser_to;
          if (aal2Url) {
            const redirectTo = new URL(aal2Url);
            if (flowType === 'settings') {
              redirectTo.searchParams.set('return_to', window.location.href);
            }
            window.location.href = redirectTo.toString();
            return;
          }
          router.push('/login?aal=aal2&return_to=' + window.location.href);
          return;
        }
        case 'session_already_available':
          router.push('/');
          return;
        case 'session_refresh_required': {
          const refreshUrl = err.response?.data?.redirect_browser_to;
          if (refreshUrl) {
            window.location.href = refreshUrl;
          }
          return;
        }
        case 'self_service_flow_return_to_forbidden':
          resetFlow(undefined);
          router.push('/' + flowType);
          return;
        case 'self_service_flow_expired':
          resetFlow(undefined);
          router.push('/' + flowType);
          return;
        case 'security_csrf_violation':
          resetFlow(undefined);
          router.push('/' + flowType);
          return;
        case 'security_identity_mismatch':
          resetFlow(undefined);
          router.push('/' + flowType);
          return;
        case 'browser_location_change_required': {
          const redirectUrl = err.response?.data?.redirect_browser_to;
          if (redirectUrl) {
            window.location.href = redirectUrl;
          }
          return;
        }
      }

      switch (err.response?.status) {
        case 410:
          resetFlow(undefined);
          router.push('/' + flowType);
          return;
      }

      return Promise.reject(err);
    },
    [flowType, resetFlow, router]
  );
}