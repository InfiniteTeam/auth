/**
 * lldap integration.
 *
 * The backend never writes identity data — it authenticates users against
 * lldap's HTTP API and reads profile/group information from lldap's GraphQL
 * endpoint. In this release the username accepted by `POST /auth/simple/login`
 * is treated as the user's lldap uid, which for the inft-auth platform is the
 * user's email address.
 */

import { Inject, Injectable } from "@nestjs/common";
import { PermissionBitField } from "@inft/shared";
import type { Role } from "@inft/shared";
import { APP_CONFIG, type AppConfig } from "../config/config.js";

/** Result of a successful lldap authentication. */
export interface LldapUser {
  /** lldap uid (also the user email for the inft-auth platform). */
  id: string;
  /** Primary email address. */
  email: string;
  /** Display name. */
  name: string;
  /** Roles derived from lldap group membership. */
  roles: Role[];
  /** Permission bitfield as a decimal string (e.g. `"7"`). */
  permissions: string;
}

/**
 * Error thrown when lldap rejects the supplied credentials.
 */
export class LldapAuthenticationError extends Error {
  constructor(message = "Invalid credentials") {
    super(message);
    this.name = "LldapAuthenticationError";
  }
}

@Injectable()
export class LldapService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  /**
   * Authenticates a user against lldap via `POST /auth/simple/login`.
   *
   * Returns the resolved {@link LldapUser} when the credentials are valid, and
   * throws {@link LldapAuthenticationError} otherwise.
   */
  async authenticate(email: string, password: string): Promise<LldapUser> {
    const uid = await this.resolveUidByEmail(email);
    if (!uid) {
      throw new LldapAuthenticationError();
    }

    const res = await fetch(`${this.config.lldapUrl}/auth/simple/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: uid, password }),
    });

    if (!res.ok) {
      throw new LldapAuthenticationError();
    }

    const user = (await this.getUserById(uid)) ?? {
      id: uid,
      email,
      name: email,
      roles: ["user"] as Role[],
      permissions: "0",
    };
    return user;
  }

  /**
   * Resolves a user's lldap uid from their primary email address by listing
   * users through the GraphQL endpoint. Returns `null` when no match is found.
   */
  private async resolveUidByEmail(email: string): Promise<string | null> {
    const jwt = await this.serviceToken();
    if (!jwt) {
      return null;
    }
    const query = `query { users { id email } }`;
    try {
      const res = await fetch(`${this.config.lldapUrl}/api/graphql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) {
        return null;
      }
      const data = (await res.json()) as {
        data?: { users?: { id: string; email?: string }[] };
      };
      const match = data.data?.users?.find((u) => u.email === email);
      return match?.id ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Fetches a user's profile directly from lldap using the configured
   * service-account credentials. Used by the OIDC `findAccount` hook to build
   * ID-token claims. Returns `undefined` when the user is not found.
   */
  async getUserById(id: string): Promise<LldapUser | undefined> {
    const jwt = await this.serviceToken();
    if (!jwt) {
      return undefined;
    }
    const query = `query($id: String!) { user(userId: $id) { id email displayName } }`;
    const res = await fetch(`${this.config.lldapUrl}/api/graphql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ query, variables: { id } }),
    });
    if (!res.ok) {
      return undefined;
    }
    const data = (await res.json()) as {
      data?: {
        user?: {
          id?: string;
          email?: string;
          displayName?: string | null;
        } | null;
      };
    };
    const user = data.data?.user;
    if (!user) {
      return undefined;
    }
    const resolvedId = user.id ?? id;
    const permissions = await this.permissionsFor(resolvedId);
    return {
      id: resolvedId,
      email: user.email ?? id,
      name: user.displayName ?? user.email ?? id,
      roles: ["user"],
      permissions,
    };
  }

  /**
   * Resolves a user's permission bitfield from lldap group membership.
   *
   * Members of the configured admin group receive every permission; everyone
   * else receives none. Returns `"0"` when lldap is unreachable.
   */
  async permissionsFor(userId: string): Promise<string> {
    const jwt = await this.serviceToken();
    if (!jwt) {
      return "0";
    }
    const query = `query { groups { id displayName users { id } } }`;
    try {
      const res = await fetch(`${this.config.lldapUrl}/api/graphql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) {
        return "0";
      }
      const data = (await res.json()) as {
        data?: {
          groups?: {
            id?: string;
            displayName?: string | null;
            users?: { id?: string }[];
          }[];
        };
      };
      const isAdmin = data.data?.groups?.some(
        (group) =>
          group.displayName === this.config.lldapAdminGroupName &&
          group.users?.some((member) => member.id === userId),
      );
      return isAdmin ? PermissionBitField.All.toString() : "0";
    } catch {
      return "0";
    }
  }

  /**
   * Obtains a service-account JWT from lldap for GraphQL calls.
   */
  private async serviceToken(): Promise<string | null> {
    try {
      const res = await fetch(`${this.config.lldapUrl}/auth/simple/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: this.config.lldapAdminDn,
          password: this.config.lldapAdminPassword,
        }),
      });
      if (!res.ok) {
        return null;
      }
      const data = (await res.json()) as { token?: string };
      return data.token ?? null;
    } catch {
      return null;
    }
  }
}
