/**
 * Shared domain types for the inft-auth platform.
 */

/**
 * Role assigned to a user.
 */
export type Role = "user" | "admin";

/**
 * Public representation of a user stored in the identity directory (lldap).
 */
export interface User {
  /** Unique user identifier (ldap uid). */
  id: string;
  /** Primary email address. */
  email: string;
  /** Whether the email address has been verified. */
  emailVerified: boolean;
  /** Display name. */
  name: string;
  /** Given (first) name, optional. */
  givenName?: string;
  /** Family (last) name, optional. */
  familyName?: string;
  /** Avatar picture URL, optional. */
  avatarUrl?: string;
  /** Roles assigned to the user. */
  roles: Role[];
  /**
   * Permission bitfield as a decimal string (e.g. `"7"`).
   * See {@link PermissionBitField} for the flag layout.
   * Absent when the user was resolved outside a session context.
   */
  permissions?: string;
  /** ISO 8601 creation timestamp. */
  createdAt: string;
  /** ISO 8601 last-updated timestamp. */
  updatedAt: string;
}

/**
 * Authentication mechanisms supported by the platform.
 */
export type AuthProvider = "ldap" | "github" | "discord";

/**
 * Lightweight user snapshot attached to a session.
 */
export interface SessionUser {
  /** The authentication mechanism used to sign in. */
  provider: AuthProvider;
  /** Unique user identifier (ldap uid). */
  userId: string;
  /** Primary email address. */
  email: string;
  /** Display name. */
  name: string;
  /** Roles assigned to the user. */
  roles: Role[];
  /**
   * Permission bitfield as a decimal string (e.g. `"7"`).
   * See {@link PermissionBitField} for the flag layout.
   */
  permissions?: string;
}

/**
 * An authenticated session. Carried in an HttpOnly cookie.
 */
export interface Session {
  /** Session identifier. */
  id: string;
  /** The authenticated user. */
  user: SessionUser;
  /** ISO 8601 issue timestamp. */
  issuedAt: string;
  /** ISO 8601 expiry timestamp. */
  expiresAt: string;
}

/**
 * Uniform error envelope returned by the REST API.
 */
export interface ApiError {
  /** Machine-readable error code. */
  error: string;
  /** Human-readable error message. */
  message: string;
  /** HTTP status code. */
  statusCode: number;
}

/**
 * Public information about an OIDC client shown on the consent screen.
 */
export interface OidcClientInfo {
  /** OAuth 2.0 client identifier. */
  clientId: string;
  /** Human-readable client name. */
  clientName: string;
  /** Scopes the client is allowed to request. */
  scopes: string[];
  /** Allowed redirect URIs. */
  redirectUris: string[];
}

/**
 * Information about an OAuth 2.0 authorization request shown to the user.
 */
export interface ConsentRequestInfo {
  /** The requesting client. */
  client: OidcClientInfo;
  /** Scopes requested by the client. */
  requestedScopes: string[];
  /** Claims requested by the client. */
  requestedClaims?: Record<string, unknown>;
}

/**
 * A directory user as exposed by the admin API (lldap-backed).
 */
export interface AdminUser {
  /** lldap uid (email address on this platform). */
  id: string;
  /** Primary email address. */
  email: string;
  /** Display name. */
  displayName: string;
  /** Names of groups the user belongs to. */
  groups: string[];
  /** Roles derived from group membership. */
  roles: Role[];
  /** Permission bitfield as a decimal string. */
  permissions: string;
}

/**
 * A directory group as exposed by the admin API (lldap-backed).
 */
export interface AdminGroup {
  /** lldap numeric group id. */
  id: number;
  /** Group display name. */
  displayName: string;
  /** Ids of member users. */
  members: string[];
}

/**
 * A session row as exposed by the admin sessions API.
 */
export interface AdminSession {
  /** Session identifier. */
  id: string;
  /** Owner user id (ldap uid). */
  userId: string;
  /** Owner email address. */
  email: string;
  /** Authentication provider used to sign in. */
  provider: AuthProvider;
  /** ISO 8601 issue timestamp. */
  issuedAt: string;
  /** ISO 8601 expiry timestamp. */
  expiresAt: string;
  /** ISO 8601 revocation timestamp, when revoked. */
  revokedAt: string | null;
  /** Whether the session is currently active. */
  active: boolean;
}

/**
 * Where an effective setting value comes from.
 */
export type SettingSource = "env" | "override";

/**
 * A single platform setting entry as exposed by the admin settings API.
 * Secret values are never returned; only their configured state.
 */
export interface AdminSettingEntry {
  /** Setting key (e.g. `social.github.clientId`). */
  key: string;
  /** Setting group for UI sectioning (e.g. `social`, `oidc`, `smtp`). */
  group: string;
  /** Human-readable label. */
  label: string;
  /** Effective value for non-secret settings; absent for secrets. */
  value?: unknown;
  /** Whether a secret value is configured (secrets only). */
  configured?: boolean;
  /** Whether the effective value comes from the environment or an override. */
  source: SettingSource;
  /** Whether changing the value requires a server restart. */
  requiresRestart: boolean;
  /** Whether the value is secret (masked in reads and logs). */
  secret: boolean;
  /** ISO 8601 last-updated timestamp of the override row, when present. */
  updatedAt?: string;
  /** Id of the admin that last updated the override, when present. */
  updatedBy?: string;
}