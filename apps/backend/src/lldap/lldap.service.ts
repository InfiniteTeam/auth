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
import { PermissionBitField } from "@inftkr/shared";
import type { Role } from "@inftkr/shared";
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

/**
 * Error thrown when a lldap write operation (e.g. `createUser`) fails.
 */
export class LldapWriteError extends Error {
  constructor(message = "lldap write operation failed") {
    super(message);
    this.name = "LldapWriteError";
  }
}

/**
 * Summary of a directory user for admin listing.
 */
export interface LldapAdminUser {
  /** lldap uid. */
  id: string;
  /** Primary email address. */
  email: string;
  /** Display name. */
  displayName: string;
  /** Display names of groups the user belongs to. */
  groups: string[];
}

/**
 * Summary of a directory group for admin listing.
 */
export interface LldapAdminGroup {
  /** lldap numeric group id. */
  id: number;
  /** Group display name. */
  displayName: string;
  /** Ids of member users. */
  members: string[];
}

/** OID of the LDAP Password Modify extended operation (RFC 3062). */
const PASSWORD_MODIFY_OID = "1.3.6.1.4.1.4203.1.11.1";

/**
 * BER-encodes a Password Modify request value:
 * `PasswdModifyRequestValue ::= SEQUENCE { userIdentity [0] OCTET STRING
 * OPTIONAL, oldPasswd [1] OCTET STRING OPTIONAL, newPasswd [2] OCTET STRING
 * OPTIONAL }`.
 */
async function encodePasswordModify(
  userIdentity?: string,
  oldPassword?: string,
  newPassword?: string,
): Promise<Buffer> {
  const { BerWriter } = await import("ldapts");
  const writer = new BerWriter();
  writer.startSequence();
  if (userIdentity !== undefined) {
    writer.writeString(userIdentity, 0x80);
  }
  if (oldPassword !== undefined) {
    writer.writeString(oldPassword, 0x81);
  }
  if (newPassword !== undefined) {
    writer.writeString(newPassword, 0x82);
  }
  writer.endSequence();
  return writer.buffer;
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
  async resolveUidByEmail(email: string): Promise<string | null> {
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
   * Creates a user through lldap's GraphQL API. Used by the social sign-up
   * flow after the reported email has been verified. Throws
   * {@link LldapWriteError} when the mutation fails (e.g. duplicate uid).
   */
  async createUser(input: {
    /** lldap uid; on the inft-auth platform this is the email address. */
    uid: string;
    /** Primary email address. */
    email: string;
    /** Display name. */
    displayName: string;
  }): Promise<void> {
    const jwt = await this.serviceToken();
    if (!jwt) {
      throw new LldapWriteError();
    }
    const mutation = `mutation($user: CreateUserInput!) { createUser(user: $user) { id } }`;
    const res = await fetch(`${this.config.lldapUrl}/api/graphql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        query: mutation,
        variables: {
          user: {
            id: input.uid,
            email: input.email,
            displayName: input.displayName,
          },
        },
      }),
    });
    if (!res.ok) {
      throw new LldapWriteError();
    }
    const body = (await res.json()) as { errors?: unknown[] };
    if (body.errors?.length) {
      throw new LldapWriteError();
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
   * Lists directory users through the GraphQL endpoint, with optional
   * case-insensitive substring filtering over id/email/displayName.
   */
  async listUsers(
    search?: string,
    limit = 50,
  ): Promise<LldapAdminUser[]> {
    const jwt = await this.serviceToken();
    if (!jwt) {
      throw new LldapWriteError("Unable to reach the directory service");
    }
    const query = `query { users { id email displayName groups { displayName } } }`;
    const res = await fetch(`${this.config.lldapUrl}/api/graphql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) {
      throw new LldapWriteError("Unable to list directory users");
    }
    const data = (await res.json()) as {
      data?: {
        users?: {
          id?: string;
          email?: string;
          displayName?: string | null;
          groups?: { displayName?: string | null }[];
        }[];
      };
      errors?: unknown[];
    };
    if (data.errors?.length) {
      throw new LldapWriteError("Unable to list directory users");
    }
    const needle = search?.toLowerCase();
    const users = (data.data?.users ?? [])
      .map((u) => ({
        id: u.id ?? "",
        email: u.email ?? "",
        displayName: u.displayName ?? u.email ?? u.id ?? "",
        groups: (u.groups ?? [])
          .map((g) => g.displayName)
          .filter((g): g is string => Boolean(g)),
      }))
      .filter((u) => Boolean(u.id))
      .filter((u) =>
        needle
          ? u.id.toLowerCase().includes(needle) ||
            u.email.toLowerCase().includes(needle) ||
            u.displayName.toLowerCase().includes(needle)
          : true,
      );
    return users.slice(0, Math.max(1, Math.min(limit, 200)));
  }

  /**
   * Lists directory groups with their member user ids.
   */
  async listGroups(): Promise<LldapAdminGroup[]> {
    const jwt = await this.serviceToken();
    if (!jwt) {
      throw new LldapWriteError("Unable to reach the directory service");
    }
    const query = `query { groups { id displayName users { id } } }`;
    const res = await fetch(`${this.config.lldapUrl}/api/graphql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) {
      throw new LldapWriteError("Unable to list directory groups");
    }
    const data = (await res.json()) as {
      data?: {
        groups?: {
          id?: number;
          displayName?: string | null;
          users?: { id?: string }[];
        }[];
      };
      errors?: unknown[];
    };
    if (data.errors?.length) {
      throw new LldapWriteError("Unable to list directory groups");
    }
    return (data.data?.groups ?? [])
      .filter((g) => typeof g.id === "number" && Boolean(g.displayName))
      .map((g) => ({
        id: g.id as number,
        displayName: g.displayName as string,
        members: (g.users ?? [])
          .map((u) => u.id)
          .filter((id): id is string => Boolean(id)),
      }));
  }

  /**
   * Updates a directory user's email/displayName via GraphQL.
   */
  async updateUserAdmin(input: {
    id: string;
    email?: string;
    displayName?: string;
  }): Promise<void> {
    const jwt = await this.serviceToken();
    if (!jwt) {
      throw new LldapWriteError();
    }
    const mutation = `mutation($user: UpdateUserInput!) { updateUser(user: $user) { ok } }`;
    const user: Record<string, unknown> = { id: input.id };
    if (input.email !== undefined) {
      user.email = input.email;
    }
    if (input.displayName !== undefined) {
      user.displayName = input.displayName;
    }
    const res = await fetch(`${this.config.lldapUrl}/api/graphql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ query: mutation, variables: { user } }),
    });
    if (!res.ok) {
      throw new LldapWriteError();
    }
    const body = (await res.json()) as { errors?: unknown[] };
    if (body.errors?.length) {
      throw new LldapWriteError();
    }
  }

  /**
   * Deletes a directory user via GraphQL.
   */
  async deleteUserAdmin(userId: string): Promise<void> {
    await this.mutate(`mutation($userId: String!) { deleteUser(userId: $userId) { ok } }`, {
      userId,
    });
  }

  /**
   * Creates a directory group via GraphQL and returns its numeric id.
   */
  async createGroupAdmin(displayName: string): Promise<number> {
    const jwt = await this.serviceToken();
    if (!jwt) {
      throw new LldapWriteError();
    }
    const mutation = `mutation($name: String!) { createGroup(name: $name) { id } }`;
    const res = await fetch(`${this.config.lldapUrl}/api/graphql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ query: mutation, variables: { name: displayName } }),
    });
    if (!res.ok) {
      throw new LldapWriteError();
    }
    const body = (await res.json()) as {
      data?: { createGroup?: { id?: number } };
      errors?: unknown[];
    };
    if (body.errors?.length || typeof body.data?.createGroup?.id !== "number") {
      throw new LldapWriteError();
    }
    return body.data.createGroup.id;
  }

  /**
   * Renames a directory group via GraphQL.
   */
  async updateGroupAdmin(groupId: number, displayName: string): Promise<void> {
    await this.mutate(
      `mutation($group: UpdateGroupInput!) { updateGroup(group: $group) { ok } }`,
      { group: { id: groupId, displayName } },
    );
  }

  /**
   * Deletes a directory group via GraphQL.
   */
  async deleteGroupAdmin(groupId: number): Promise<void> {
    await this.mutate(`mutation($groupId: Int!) { deleteGroup(groupId: $groupId) { ok } }`, {
      groupId,
    });
  }

  /**
   * Adds a user to a group via GraphQL.
   */
  async addUserToGroup(userId: string, groupId: number): Promise<void> {
    await this.mutate(
      `mutation($userId: String!, $groupId: Int!) { addUserToGroup(userId: $userId, groupId: $groupId) { ok } }`,
      { userId, groupId },
    );
  }

  /**
   * Removes a user from a group via GraphQL.
   */
  async removeUserFromGroup(userId: string, groupId: number): Promise<void> {
    await this.mutate(
      `mutation($userId: String!, $groupId: Int!) { removeUserFromGroup(userId: $userId, groupId: $groupId) { ok } }`,
      { userId, groupId },
    );
  }

  /**
   * Executes a GraphQL mutation with the service-account token.
   */
  private async mutate(query: string, variables: Record<string, unknown>): Promise<void> {
    const jwt = await this.serviceToken();
    if (!jwt) {
      throw new LldapWriteError();
    }
    const res = await fetch(`${this.config.lldapUrl}/api/graphql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) {
      throw new LldapWriteError();
    }
    const body = (await res.json()) as { errors?: unknown[] };
    if (body.errors?.length) {
      throw new LldapWriteError();
    }
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
   * Changes a user's password via the LDAP Password Modify extended operation
   * (RFC 3062, OID 1.3.6.1.4.1.4203.1.11.1), binding as the user. The current
   * password acts as proof of ownership; no GraphQL password API exists.
   */
  async changePasswordAsUser(
    uid: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const { Client } = await import("ldapts");
    const client = new Client({ url: this.config.lldapLdapUrl });
    try {
      await client.bind(this.userDn(uid), currentPassword);
      await client.exop(
        PASSWORD_MODIFY_OID,
        await encodePasswordModify(this.userDn(uid), currentPassword, newPassword),
      );
    } catch {
      throw new LldapAuthenticationError("Password change failed");
    } finally {
      await client.unbind().catch(() => undefined);
    }
  }

  /**
   * Sets a user's password via the LDAP Password Modify extended operation,
   * binding as the service-account admin. Used for social-only accounts with
   * no LDAP password yet and for admin-initiated resets.
   */
  async setPasswordAsAdmin(uid: string, newPassword: string): Promise<void> {
    const { Client } = await import("ldapts");
    const client = new Client({ url: this.config.lldapLdapUrl });
    try {
      await client.bind(this.userDn(this.config.lldapAdminDn), this.config.lldapAdminPassword);
      await client.exop(
        PASSWORD_MODIFY_OID,
        await encodePasswordModify(this.userDn(uid), undefined, newPassword),
      );
    } catch {
      throw new LldapWriteError("Password reset failed");
    } finally {
      await client.unbind().catch(() => undefined);
    }
  }

  /**
   * Builds the LDAP distinguished name of a user.
   */
  private userDn(uid: string): string {
    return `uid=${uid},ou=people,${this.config.lldapBaseDn}`;
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
