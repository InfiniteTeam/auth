/**
 * Permission guard — authorises requests against the authenticated session's
 * permission bitfield.
 *
 * Decorate a handler with `@Permissions(...)` (or `@Permissions()` on the
 * controller) and mount {@link PermissionsGuard}. The guard first authenticates
 * the request through {@link SessionGuard} (401 when no valid session exists),
 * then asserts that the session user's `permissions` bitfield contains every
 * required flag (403 otherwise).
 */

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Scope,
  SetMetadata,
  UnauthorizedException,
} from "@nestjs/common";
import { PermissionBitField } from "@inft/shared";
import type { PermissionResolvable } from "@inft/shared";
import type { Session } from "@inft/shared";
import type { Request } from "express";
import { SessionGuard } from "./session.guard.js";

/** Metadata key holding the permissions required by a handler. */
export const PERMISSIONS_KEY = "requiredPermissions";

/**
 * Declares the permissions a handler requires. Combine with
 * {@link PermissionsGuard}.
 */
export const Permissions = (...permissions: PermissionResolvable[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * Nest `CanActivate` guard that authenticates the request and then asserts the
 * session user holds every permission declared via {@link Permissions}.
 */
@Injectable({ scope: Scope.REQUEST })
export class PermissionsGuard implements CanActivate {
  constructor(private readonly sessionGuard: SessionGuard) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const authenticated = await this.sessionGuard.canActivate(context);
    if (!authenticated) {
      throw new UnauthorizedException();
    }

    const handlerPermissions = Reflect.getMetadata(
      PERMISSIONS_KEY,
      context.getHandler(),
    );
    const controllerClass = context.getClass();
    const classPermissions = controllerClass
      ? Reflect.getMetadata(PERMISSIONS_KEY, controllerClass)
      : undefined;
    const required = (handlerPermissions ??
      classPermissions) as PermissionResolvable[] | undefined;
    if (!required || required.length === 0) {
      return true;
    }

    const req = context
      .switchToHttp()
      .getRequest<Request & { session?: Session }>();
    const userPermissions = new PermissionBitField(req.session?.user.permissions);
    if (!userPermissions.has(required)) {
      throw new ForbiddenException();
    }
    return true;
  }
}