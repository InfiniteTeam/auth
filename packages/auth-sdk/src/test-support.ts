/**
 * Test-only helper: an in-process OIDC provider stub used by the vitest suite.
 * Not part of the public API.
 */

import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import type { OidcDiscovery, TokenResponse, UserInfo } from "./types.js";

/**
 * Things about the stub that tests can mutate between requests.
 */
export interface StubState {
  issuer?: string;
  audience?: string;
  sub?: string;
  idTokenClaims?: Record<string, unknown>;
  idTokenAlg?: string;
  discovery?: Partial<OidcDiscovery>;
  userInfo?: Partial<UserInfo>;
  tokenResponse?: Partial<TokenResponse>;
  failJwks?: boolean;
  failToken?: boolean;
}

/**
 * A request observed by the stub.
 */
export interface StubRequest {
  method: string;
  path: string;
  body?: URLSearchParams;
  authorization?: string;
}

/**
 * An in-process OIDC provider for testing the SDK against real HTTP.
 */
export interface OidcStub {
  /** Base URL of the stub provider, available after `createOidcStub()` resolves. */
  baseUrl: string;
  /** Mutable provider state. */
  state: StubState;
  /** Endpoint hit counters. */
  counters: {
    discovery: number;
    jwks: number;
    token: number;
    userinfo: number;
  };
  /** Every request observed by the stub, in order. */
  requests: StubRequest[];
  /** The most recent token endpoint request. */
  lastTokenRequest(): StubRequest | undefined;
  /** Closes the HTTP server. */
  stop(): Promise<void>;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, body: unknown): void {
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

/**
 * Starts a stub OIDC provider on a local port.
 */
export async function createOidcStub(): Promise<OidcStub> {
  const { publicKey, privateKey } = await generateKeyPair("ES256");
  const publicJwk = await exportJWK(publicKey);
  publicJwk.alg = "ES256";
  publicJwk.use = "sig";
  publicJwk.kid = "stub-key";

  const state: StubState = {};
  const requests: StubRequest[] = [];
  const counters = { discovery: 0, jwks: 0, token: 0, userinfo: 0 };
  let baseUrl = "";

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const method = req.method ?? "GET";

    if (url.pathname === "/.well-known/openid-configuration") {
      counters.discovery++;
      sendJson(res, {
        issuer: state.issuer ?? baseUrl,
        authorization_endpoint: `${baseUrl}/authorize`,
        token_endpoint: `${baseUrl}/token`,
        userinfo_endpoint: `${baseUrl}/userinfo`,
        jwks_uri: `${baseUrl}/jwks`,
        end_session_endpoint: `${baseUrl}/logout`,
        id_token_signing_alg_values_supported: ["ES256"],
        ...state.discovery,
      });
      return;
    }

    if (url.pathname === "/jwks") {
      counters.jwks++;
      if (state.failJwks) {
        res.statusCode = 500;
        res.end();
        return;
      }
      sendJson(res, { keys: [publicJwk] });
      return;
    }

    if (url.pathname === "/token" && method === "POST") {
      counters.token++;
      const raw = await readBody(req);
      const body = new URLSearchParams(raw);
      requests.push({
        method,
        path: url.pathname,
        body,
        authorization: req.headers.authorization,
      });
      if (state.failToken) {
        res.statusCode = 400;
        sendJson(res, { error: "invalid_grant" });
        return;
      }
      const now = Math.floor(Date.now() / 1000);
      const idToken = await new SignJWT({
        sub: state.sub ?? "user-1",
        iss: state.issuer ?? baseUrl,
        aud: state.audience ?? "test-client",
        iat: now,
        exp: now + 300,
        ...state.idTokenClaims,
      })
        .setProtectedHeader({
          alg: state.idTokenAlg ?? "ES256",
          kid: "stub-key",
        })
        .sign(privateKey);
      sendJson(res, {
        access_token: "access-token-1",
        token_type: "Bearer",
        expires_in: 3600,
        refresh_token: "refresh-token-1",
        id_token: idToken,
        scope: "openid profile email",
        ...state.tokenResponse,
      });
      return;
    }

    if (url.pathname === "/userinfo") {
      counters.userinfo++;
      sendJson(res, {
        sub: state.sub ?? "user-1",
        email: "user@example.com",
        email_verified: true,
        ...state.userInfo,
      });
      return;
    }

    if (url.pathname === "/logout") {
      sendJson(res, {});
      return;
    }

    res.statusCode = 404;
    res.end();
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    baseUrl,
    state,
    counters,
    requests,
    lastTokenRequest: () =>
      [...requests].reverse().find((r) => r.path === "/token"),
    stop: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  };
}
