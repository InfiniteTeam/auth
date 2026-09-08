import { afterEach, describe, expect, it } from "vitest";
import { OidcClient } from "./client.js";
import { OIDC_ERROR_CODES } from "./errors.js";
import { createOidcStub, type OidcStub } from "./test-support.js";
import type { OidcClientOptions } from "./types.js";

const stubs: OidcStub[] = [];

afterEach(async () => {
  await Promise.all(stubs.splice(0).map((s) => s.stop()));
});

async function newClient(overrides: Partial<OidcClientOptions> = {}) {
  const stub = await createOidcStub();
  stubs.push(stub);
  const client = new OidcClient({
    issuerUrl: stub.baseUrl,
    clientId: "test-client",
    ...overrides,
  });
  return { stub, client };
}

describe("verifyIdToken", () => {
  it("accepts a token signed by the provider's JWKS", async () => {
    const { stub, client } = await newClient();
    const tokens = await client.exchangeCode("code-1", {
      verifier: "test-verifier",
      redirectUri: "https://app.example.com/callback",
    });

    const claims = await client.verifyIdToken(tokens.id_token);
    expect(claims.sub).toBe("user-1");
    expect(claims.iss).toBe(stub.baseUrl);
    expect(claims.aud).toBe("test-client");
  });

  it("enforces the nonce claim", async () => {
    const { client } = await newClient();
    const tokens = await client.exchangeCode("code-1", {
      verifier: "test-verifier",
      redirectUri: "https://app.example.com/callback",
    });

    await expect(
      client.verifyIdToken(tokens.id_token, { nonce: "not-the-flow-nonce" }),
    ).rejects.toMatchObject({ code: OIDC_ERROR_CODES.NONCE_MISMATCH });

    const ok = await client.verifyIdToken(tokens.id_token, {
      nonce: undefined,
    });
    expect(ok.sub).toBe("user-1");
  });

  it("rejects tokens issued by another issuer", async () => {
    const { stub, client } = await newClient({ discoveryCacheTtlMs: 0 });
    const tokens = await client.exchangeCode("code-1", {
      verifier: "test-verifier",
      redirectUri: "https://app.example.com/callback",
    });

    stub.state.issuer = "http://evil.example.com";
    await expect(client.verifyIdToken(tokens.id_token)).rejects.toMatchObject({
      code: OIDC_ERROR_CODES.ID_TOKEN_INVALID,
    });
  });

  it("rejects tokens issued for another audience", async () => {
    const { stub, client } = await newClient();
    stub.state.audience = "some-other-client";
    const tokens = await client.exchangeCode("code-1", {
      verifier: "test-verifier",
      redirectUri: "https://app.example.com/callback",
    });

    await expect(client.verifyIdToken(tokens.id_token)).rejects.toMatchObject({
      code: OIDC_ERROR_CODES.ID_TOKEN_INVALID,
    });
  });

  it("rejects tokens signed with a disallowed algorithm", async () => {
    const { stub, client } = await newClient({ algorithms: ["RS256"] });
    stub.state.idTokenAlg = "ES256";
    const tokens = await client.exchangeCode("code-1", {
      verifier: "test-verifier",
      redirectUri: "https://app.example.com/callback",
    });

    await expect(client.verifyIdToken(tokens.id_token)).rejects.toMatchObject({
      code: OIDC_ERROR_CODES.ID_TOKEN_INVALID,
    });
  });

  it("fails when the provider exposes no jwks_uri", async () => {
    const { stub, client } = await newClient();
    stub.state.discovery = { jwks_uri: undefined };

    await expect(client.verifyIdToken("a.b.c")).rejects.toMatchObject({
      code: OIDC_ERROR_CODES.JWKS_UNAVAILABLE,
    });
  });

  it("succeeds when the audience is explicitly widened", async () => {
    const { stub, client } = await newClient();
    stub.state.audience = "app-x";
    const tokens = await client.exchangeCode("code-1", {
      verifier: "test-verifier",
      redirectUri: "https://app.example.com/callback",
    });

    const claims = await client.verifyIdToken(tokens.id_token, {
      audience: ["app-x"],
    });
    expect(claims.sub).toBe("user-1");
  });
});
