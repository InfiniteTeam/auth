/**
 * Unit tests for the permission bitfield guard.
 */

import { describe, expect, it, vi } from "vitest";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { PermissionFlags, type Session } from "@inftkr/shared";
import {
  PERMISSIONS_KEY,
  PermissionsGuard,
} from "./permissions.guard.js";
import { SessionGuard } from "./session.guard.js";

function session(permissions?: string): Session {
  return {
    id: "session-id",
    user: {
      provider: "ldap",
      userId: "devuser",
      email: "devuser@inftkr.kr",
      name: "Dev User",
      roles: ["user"],
      ...(permissions ? { permissions } : {}),
    },
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
}

function makeContext(
  permissions?: string,
  controllerClass?: new () => unknown,
): ExecutionContext {
  const handler = () => "handler";
  const req: { session?: Session } = {};
  if (permissions) {
    req.session = session(permissions);
  }
  return {
    getHandler: () => handler,
    getClass: () => controllerClass,
    switchToHttp: () => ({
      getRequest: () => req as never,
    }),
  } as unknown as ExecutionContext;
}

describe("PermissionsGuard", () => {
  it("throws Unauthorized when there is no valid session", async () => {
    const sessionGuard = {
      canActivate: vi.fn().mockResolvedValue(false),
    } as unknown as SessionGuard;
    const guard = new PermissionsGuard(sessionGuard);
    await expect(guard.canActivate(makeContext())).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("allows requests without required permissions", async () => {
    const sessionGuard = {
      canActivate: vi.fn().mockResolvedValue(true),
    } as unknown as SessionGuard;
    const guard = new PermissionsGuard(sessionGuard);
    await expect(guard.canActivate(makeContext("0"))).resolves.toBe(true);
  });

  it("throws Forbidden when the user lacks a required permission", async () => {
    const sessionGuard = {
      canActivate: vi.fn().mockResolvedValue(true),
    } as unknown as SessionGuard;
    const handler = () => "handler";
    Reflect.defineMetadata(
      PERMISSIONS_KEY,
      [PermissionFlags.OidcClientCreate],
      handler,
    );
    const context = makeContext("0") as unknown as ExecutionContext & {
      getHandler: () => typeof handler;
    };
    context.getHandler = () => handler;
    const guard = new PermissionsGuard(sessionGuard);
    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("allows requests whose user holds every required permission", async () => {
    const sessionGuard = {
      canActivate: vi.fn().mockResolvedValue(true),
    } as unknown as SessionGuard;
    const handler = () => "handler";
    Reflect.defineMetadata(
      PERMISSIONS_KEY,
      [PermissionFlags.OidcClientRead, PermissionFlags.OidcClientCreate],
      handler,
    );
    const context = makeContext("7") as unknown as ExecutionContext & {
      getHandler: () => typeof handler;
    };
    context.getHandler = () => handler;
    const guard = new PermissionsGuard(sessionGuard);
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("honours decimal-string permission storage", async () => {
    const sessionGuard = {
      canActivate: vi.fn().mockResolvedValue(true),
    } as unknown as SessionGuard;
    const handler = () => "handler";
    Reflect.defineMetadata(
      PERMISSIONS_KEY,
      [PermissionFlags.OidcClientDelete],
      handler,
    );
    const context = makeContext("4") as unknown as ExecutionContext & {
      getHandler: () => typeof handler;
    };
    context.getHandler = () => handler;
    const guard = new PermissionsGuard(sessionGuard);
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("reads controller-level permissions when the handler has none", async () => {
    class ClientsController {}
    Reflect.defineMetadata(
      PERMISSIONS_KEY,
      [PermissionFlags.OidcClientRead],
      ClientsController,
    );
    const sessionGuard = {
      canActivate: vi.fn().mockResolvedValue(true),
    } as unknown as SessionGuard;
    const guard = new PermissionsGuard(
      sessionGuard,
    );
    await expect(
      guard.canActivate(makeContext("1", ClientsController)),
    ).resolves.toBe(true);
  });

  it("throws Forbidden for controller-level permissions the user lacks", async () => {
    class ClientsController {}
    Reflect.defineMetadata(
      PERMISSIONS_KEY,
      [PermissionFlags.OidcClientCreate],
      ClientsController,
    );
    const sessionGuard = {
      canActivate: vi.fn().mockResolvedValue(true),
    } as unknown as SessionGuard;
    const guard = new PermissionsGuard(sessionGuard);
    await expect(
      guard.canActivate(makeContext("1", ClientsController)),
    ).rejects.toThrow(ForbiddenException);
  });
});