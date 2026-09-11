'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Consent decision buttons.
 *
 * Plain navigation via `window.location.assign` (never Next `<Link>`): these
 * URLs mutate server-side interaction state, and Link prefetch or a double
 * click would submit the decision twice — consuming the interaction and
 * breaking the resume with `invalid_request`. Buttons disable after the
 * first click.
 */
export function ConsentActions({ allowUrl, denyUrl }: { allowUrl: string; denyUrl: string }) {
  const [pending, setPending] = useState<'allow' | 'deny' | null>(null);

  const go = useCallback(
    (decision: 'allow' | 'deny') => {
      if (pending) {
        return;
      }
      setPending(decision);
      window.location.assign(decision === 'allow' ? allowUrl : denyUrl);
    },
    [allowUrl, denyUrl, pending],
  );

  return (
    <div className="inline-actions">
      <Button size="lg" variant="outline" disabled={pending !== null} onClick={() => go('deny')}>
        {pending === 'deny' ? '처리 중…' : '거부'}
      </Button>
      <Button size="lg" disabled={pending !== null} onClick={() => go('allow')}>
        {pending === 'allow' ? '처리 중…' : '동의하고 연결'}
      </Button>
    </div>
  );
}
