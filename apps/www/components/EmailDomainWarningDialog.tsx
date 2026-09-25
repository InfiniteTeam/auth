'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { EmailDomainPolicy } from '@/lib/account';

/**
 * Remembers, for this browser session only, that the user dismissed the
 * warning for a given address. Keyed by email so that changing the address
 * surfaces the warning again if the new domain is also outside the allow-list.
 */
const DISMISSED_KEY = 'inft.emailDomainWarning.dismissed';

function readDismissedEmail(): string | null {
  try {
    return window.sessionStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
}

function writeDismissedEmail(email: string | null): void {
  try {
    if (email === null) {
      window.sessionStorage.removeItem(DISMISSED_KEY);
    } else {
      window.sessionStorage.setItem(DISMISSED_KEY, email);
    }
  } catch {
    // Storage unavailable (private mode): fall back to warning every visit.
  }
}

/**
 * Dismissible warning for accounts whose email domain is outside the
 * allow-list, explaining that LDAP features are unavailable until the address
 * is changed. Social sign-in keeps working either way.
 *
 * Driven by an already-fetched policy so a page only needs one request;
 * a `null` policy (still loading, or the read failed) renders nothing.
 */
export function EmailDomainWarningDialog({
  policy,
  onChangeEmail,
}: {
  policy: EmailDomainPolicy | null;
  /**
   * Overrides the default navigation to `/settings`. Used when the dialog is
   * already rendered on that page, where pushing the same route would not
   * remount anything.
   */
  onChangeEmail?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!policy) {
      return;
    }
    if (policy.domainAllowed) {
      // The account is eligible again; forget any earlier dismissal.
      if (readDismissedEmail() !== null) {
        writeDismissedEmail(null);
      }
      setOpen(false);
      return;
    }
    setOpen(readDismissedEmail() !== policy.email);
  }, [policy]);

  const onLater = useCallback(() => {
    if (policy) {
      writeDismissedEmail(policy.email);
    }
    setOpen(false);
  }, [policy]);

  const onGoToSettings = useCallback(() => {
    setOpen(false);
    if (onChangeEmail) {
      onChangeEmail();
      return;
    }
    router.push('/settings');
  }, [onChangeEmail, router]);

  if (!policy || policy.domainAllowed) {
    return null;
  }

  const allowed = policy.allowedDomains;

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : onLater())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>이메일 도메인을 변경해 주세요</DialogTitle>
          <DialogDescription>
            현재 이메일 <strong>{policy.email}</strong> 은(는) 사용이 제한된 도메인입니다.
            {allowed.length > 0 ? (
              <>
                {' '}
                사용 가능한 도메인은 <strong>{allowed.join(', ')}</strong> 입니다.
              </>
            ) : (
              ' 현재 사용 가능한 도메인이 설정되어 있지 않습니다.'
            )}
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          이메일을 변경하지 않으면 LDAP 로그인과 비밀번호 관리 등 LDAP 기능을 사용할 수 없습니다. 소셜
          로그인은 그대로 이용할 수 있습니다.
        </p>
        <DialogFooter>
          <Button size="sm" variant="outline" render={<DialogClose />}>
            나중에
          </Button>
          <Button size="sm" onClick={onGoToSettings}>
            이메일 변경하러 가기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
