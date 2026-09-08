import type { Session, SessionUser } from "@inft/shared";

/**
 * Abstraction that resolves the current {@link Session} from a request.
 *
 * The web framework (Nest.js) provides the concrete implementation by
 * reading the session cookie and verifying its signature.
 */
export interface SessionResolver {
  /** Returns the authenticated session, or `null` when unauthenticated. */
  resolveSession(): Promise<Session | null>;
}

/**
 * Minimal view of an incoming HTTP request used by the auth guards.
 */
export interface RequestContext {
  /** Cookie map keyed by cookie name. */
  cookies: Record<string, string | undefined>;
}

/**
 * Callback invoked once a request has been authenticated.
 */
export type AuthenticatedHandler = (userId: string, session: Session) => void | Promise<void>;

/**
 * Guard contract implemented by the authentication layer.
 */
export interface AuthGuard {
  /** Returns `true` when the request carries a valid session. */
  canActivate(context: RequestContext): Promise<boolean>;
}

/**
 * Default guard that checks for a valid session before passing the request
 * through. Optionally forwards the authenticated user/session downstream.
 */
export class SessionGuard implements AuthGuard {
  constructor(
    private readonly sessionResolver: SessionResolver,
    private readonly onAuthenticated?: AuthenticatedHandler,
  ) {}

  /** @inheritDoc */
  async canActivate(context: RequestContext): Promise<boolean> {
    const session = await this.sessionResolver.resolveSession();
    if (!session) {
      return false;
    }
    await this.onAuthenticated?.(session.user.userId, session);
    return true;
  }
}

/**
 * Extracts the {@link SessionUser} payload out of a session.
 */
export function sessionToUser(session: Session): SessionUser {
  return session.user;
}