/**
 * ID token verification built on jose.
 *
 * Signatures are validated against a provider's JWKS (public keys only — no
 * secrets are involved in ID token verification), then the OIDC claims
 * (issuer, audience, nonce, timestamps) are enforced.
 */

import { createLocalJWKSet, jwtVerify, type JWK } from "jose";
import { OIDC_ERROR_CODES, OidcError } from "./errors.js";
import type { LoginClaims } from "./types.js";

/**
 * Resolver type produced by {@link createLocalJwkSet}.
 */
export type LocalJwkSet = ReturnType<typeof createLocalJWKSet>;

/**
 * A JSON Web Key Set document ({@link https://datatracker.ietf.org/doc/html/rfc7517 §4}).
 */
export interface JsonWebKeySet {
  /** The set of keys. */
  keys: JWK[];
}

/**
 * Default JWS algorithms allowed to sign ID tokens.
 */
export const DEFAULT_ID_TOKEN_ALGORITHMS = ["RS256", "ES256"] as const;

/**
 * Parameters for {@link verifyJwt}.
 */
export interface VerifyJwtParameters {
  /**
   * Expected issuer. Must match the provider's advertised `issuer`.
   */
  issuer: string;

  /**
   * Expected audience. Defaults to the client identifier when unset.
   */
  audience?: string | string[];

  /**
   * Value the `nonce` claim must equal. Enforced when provided.
   */
  nonce?: string;

  /**
   * JWS algorithms allowed to sign the token.
   */
  algorithms?: string[];

  /**
   * Clock leeway in seconds allowed for `exp`/`nbf`/`iat`.
   */
  clockTolerance?: number;
}

/**
 * Builds a local JWKS key resolver from a `JSON Web Key Set` document fetched
 * from the provider's `jwks_uri`.
 */
export function createLocalJwkSet(jwks: JsonWebKeySet): LocalJwkSet {
  return createLocalJWKSet(jwks);
}

/**
 * Verifies the signature and claims of an ID token using a local JWKS
 * resolver.
 *
 * Throws {@link OidcError} with code `id_token_invalid` on signature/claim
 * failure and `nonce_mismatch` when the `nonce` claim does not match.
 */
export async function verifyJwt(
  idToken: string,
  jwks: LocalJwkSet,
  params: VerifyJwtParameters,
): Promise<LoginClaims> {
  const { issuer, audience, nonce, algorithms, clockTolerance } = params;

  let payload: Awaited<ReturnType<typeof jwtVerify>>["payload"];
  try {
    const result = await jwtVerify(idToken, jwks, {
      issuer,
      audience,
      algorithms: algorithms ?? [...DEFAULT_ID_TOKEN_ALGORITHMS],
      clockTolerance,
    });
    payload = result.payload;
  } catch (err) {
    throw new OidcError(
      `ID token verification failed: ${(err as Error).message}`,
      OIDC_ERROR_CODES.ID_TOKEN_INVALID,
      undefined,
      err,
    );
  }

  if (nonce && payload.nonce !== nonce) {
    throw new OidcError(
      "ID token nonce does not match the expected value",
      OIDC_ERROR_CODES.NONCE_MISMATCH,
      undefined,
      { expected: nonce, received: payload.nonce },
    );
  }

  return payload as LoginClaims;
}
