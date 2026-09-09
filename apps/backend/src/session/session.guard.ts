/**
 * Nest adapter over the `@inftkr/auth-core` shared auth layer.
 *
 * The shared {@link SessionResolver} contract resolves the current request's
 * session with no arguments — the resolver is expected to know the request
 * already. We implement it as a request-scoped provider that reads the signed
 * `inft_session` cookie from the underlying Express request.
 */

import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Scope,
} from "@nestjs/common";
import { REQUEST } from "@nestjs/core";
import type { SessionResolver as AuthCoreSessionResolver } from "@inftkr/auth-core";
import { SESSION_COOKIE_NAME } from "@inftkr/shared";
import type { Session } from "@inftkr/shared";
import type { Request } from "express";
import { SessionService } from "./session.service.js";

/** A request-scoped value that carries the authenticated session, if any. */
export const SESSION = Symbol("SESSION");

/** Reads the `inft_session` cookie value from an Express request. */
export function readSessionCookie(req: Request): string | undefined {
  return (req.cookies as Record<string, string | undefined> | undefined)?.[
    SESSION_COOKIE_NAME
  ];
}

/**
 * Request-scoped resolver that implements the `@inftkr/auth-core`
 * {@link AuthCoreSessionResolver} contract by reading the current request's
 * signed `inft_session` cookie.
 */
@Injectable({ scope: Scope.REQUEST })
export class SessionResolver implements AuthCoreSessionResolver {
  constructor(
    @Inject(REQUEST) private readonly request: Request,
    private readonly sessionService: SessionService,
  ) {}

  /** @inheritDoc */
  async resolveSession(): Promise<Session | null> {
    return this.sessionService.resolveSessionFromCookie(
      readSessionCookie(this.request),
    );
  }
}

/**
 * Nest `CanActivate` guard that authenticates requests against the signed
 * `inft_session` cookie. On success it publishes the session under the
 * {@link SESSION} request-scoped token.
 */
@Injectable({ scope: Scope.REQUEST })
export class SessionGuard implements CanActivate {
  constructor(
    @Inject(REQUEST) private readonly request: Request,
    private readonly sessionService: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const session = await this.sessionService.resolveSessionFromCookie(
      readSessionCookie(this.request),
    );
    if (!session) {
      return false;
    }
    const req = context
      .switchToHttp()
      .getRequest<Request & { session?: Session }>();
    req.session = session;
    return true;
  }
}
