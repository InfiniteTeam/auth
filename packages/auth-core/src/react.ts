import { useCallback, useEffect, useState } from "react";
import type { Session } from "@inftkr/shared";
import { AuthApiClient, AuthApiError } from "./client.js";

/**
 * Options for {@link useSession}.
 */
export interface UseSessionOptions {
  /** Backend base URL. Defaults to the same origin. */
  baseUrl?: string;
  /** Set to `false` to disable the background fetch. */
  enabled?: boolean;
}

/**
 * State returned by {@link useSession}.
 */
export interface SessionState {
  /** Current session, or `null` when unauthenticated/loading failed. */
  session: Session | null;
  /** `true` while the session is being fetched. */
  isLoading: boolean;
  /** Set when the fetch failed unexpectedly. */
  error?: Error;
}

/**
 * React hook that fetches and observes the current session.
 *
 * When sessions are managed elsewhere (e.g. after sign-in/out), remount the
 * hook or toggle `enabled` to refresh the state.
 */
export function useSession(options: UseSessionOptions = {}): SessionState {
  const baseUrl = options.baseUrl ?? "";
  const enabled = options.enabled ?? true;
  const [state, setState] = useState<SessionState>({
    session: null,
    isLoading: true,
  });

  useEffect(() => {
    if (!enabled) {
      setState({ session: null, isLoading: false });
      return;
    }

    let cancelled = false;
    const client = new AuthApiClient({ baseUrl });

    client
      .session()
      .then((session) => {
        if (!cancelled) {
          setState({ session, isLoading: false });
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setState({ session: null, isLoading: false, error });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [baseUrl, enabled]);

  return state;
}

/**
 * React hook exposing sign-in actions for LDAP and social providers.
 */
export function useSignIn(baseUrl = "") {
  const client = new AuthApiClient({ baseUrl });
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Signs in with LDAP credentials.
   */
  const signInLdap = useCallback(
    async (email: string, password: string) => {
      setIsLoading(true);
      try {
        return await client.loginLdap({ email, password });
      } finally {
        setIsLoading(false);
      }
    },
    [client],
  );

  /**
   * Starts a social sign-in flow for the given provider.
   */
  const signInSocial = useCallback(
    async (provider: "github" | "discord") => {
      setIsLoading(true);
      try {
        await client.loginSocial(provider);
      } finally {
        setIsLoading(false);
      }
    },
    [client],
  );

  return { signInLdap, signInSocial, isLoading };
}

/**
 * React hook exposing the email-verification actions for social sign-up.
 * `verify` completes verification and signs the user in; `resend` requests a
 * fresh verification email.
 */
export function useSocialVerification(baseUrl = "") {
  const client = new AuthApiClient({ baseUrl });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Verifies the sign-up email with the emailed six-digit code.
   */
  const verify = useCallback(
    async (accountId: string, code: string): Promise<Session | null> => {
      setIsLoading(true);
      setError(null);
      try {
        return await client.verifySocialEmail(accountId, code);
      } catch (err) {
        setError(
          err instanceof AuthApiError
            ? err.message
            : "Verification failed. Please try again.",
        );
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [client],
  );

  /**
   * Requests a fresh verification email for a pending sign-up account.
   */
  const resend = useCallback(
    async (accountId: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);
      try {
        await client.resendSocialVerification(accountId);
        return true;
      } catch (err) {
        setError(
          err instanceof AuthApiError
            ? err.message
            : "Unable to resend the verification email.",
        );
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [client],
  );

  return { verify, resend, isLoading, error };
}

/**
 * React hook exposing a sign-out action.
 */
export function useSignOut(baseUrl = "") {
  const client = new AuthApiClient({ baseUrl });

  const signOut = useCallback(async () => {
    await client.logout();
  }, [client]);

  return { signOut };
}