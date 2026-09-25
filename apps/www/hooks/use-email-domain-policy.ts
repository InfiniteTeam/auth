'use client';

import { useEffect, useState } from 'react';
import { getEmailDomainPolicy, type EmailDomainPolicy } from '@/lib/account';

/**
 * Reads the email-domain policy for the signed-in account.
 *
 * Social sign-up is not domain-gated, so an account can exist with an email
 * outside the allow-list. Such an account cannot use LDAP features, and the UI
 * surfaces that as a dismissible warning. `null` is returned while the policy is
 * loading or if the request failed — callers must treat that as "unknown" and
 * stay quiet rather than warn spuriously.
 *
 * Mount this once per page and pass the result down; it does not dedupe.
 */
export function useEmailDomainPolicy(enabled: boolean): EmailDomainPolicy | null {
  const [policy, setPolicy] = useState<EmailDomainPolicy | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let active = true;
    void getEmailDomainPolicy()
      .then((result) => {
        if (active) {
          setPolicy(result);
        }
      })
      .catch(() => {
        // Network or session failure: leave the policy unknown.
      });
    return () => {
      active = false;
    };
  }, [enabled]);

  return policy;
}
