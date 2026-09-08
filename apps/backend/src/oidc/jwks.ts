/**
 * Persistent OIDC signing keys.
 *
 * oidc-provider needs a private key to sign ID tokens, and the discovery
 * document's JWKS must expose the matching public key. We generate an RSA
 * key-pair once and persist it as a JWK-set JSON file (`OIDC_JWKS_PATH`), so
 * restarting the process does not invalidate previously issued tokens.
 */

import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/** A JWK-set containing at least one RSA signing key. */
export interface Jwks {
  keys: Record<string, string>[];
}

/**
 * Loads the signing key-set from `path`, generating and persisting a new one
 * when none exists.
 */
export function loadOrCreateJwks(path: string): Jwks {
  if (existsSync(path)) {
    return JSON.parse(readFileSync(path, "utf8")) as Jwks;
  }

  const jwks = generateJwks();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(jwks, null, 2)}\n`, "utf8");
  return jwks;
}

/**
 * Generates an RSA JWK-set holding a single signing key (`RS256`).
 */
function generateJwks(): Jwks {
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicExponent: 0x10001,
  });
  const jwk = privateKey.export({ format: "jwk" }) as Record<string, string>;
  const kid = `rsa-${(jwk.n ?? "").slice(0, 16)}`;
  return {
    keys: [
      {
        ...jwk,
        kid,
        alg: "RS256",
        use: "sig",
      },
    ],
  };
}
