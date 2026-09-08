import { afterEach, describe, expect, it } from "vitest";
import { OidcClient } from "./client.js";
import { createOidcStub, type OidcStub } from "./test-support.js";
import type { OidcClientOptions } from "./types.js";

const REDIRECT_URI = "https://app.example.com/callback";

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

describe("OidcClient full flow", () => {
  it("runs authorization, exchange, verification, userinfo, refresh and logout", async () => {
    const { stub, client } = await newClient();

    const flow = await client.startAuthFlow({ redirectUri: REDIRECT_URI });
    expect(new URL(flow.url).pathname).toBe("/authorize");
    stub.state.idTokenClaims = { nonce: flow.nonce };

    const tokens = await client.exchangeCode("auth-code-1", {
      verifier: flow.verifier,
      redirectUri: REDIRECT_URI,
    });
    expect(tokens.access_token).toBe("access-token-1");
    expect(tokens.refresh_token).toBe("refresh-token-1");
    expect(tokens.id_token).toBeDefined();

    const claims = await client.verifyIdToken(tokens.id_token, {
      nonce: flow.nonce,
    });
    expect(claims.sub).toBe("user-1");

    const user = await client.getUserinfo(tokens.access_token);
    expect(user.email).toBe("user@example.com");

    const refreshed = await client.refreshToken(tokens.refresh_token ?? "");
    expect(refreshed.access_token).toBeDefined();

    const logoutUrl = await client.buildEndSessionUrl({
      idToken: tokens.id_token,
      postLogoutRedirectUri: "https://app.example.com/bye",
    });
    const logout = new URL(logoutUrl);
    expect(logout.pathname).toBe("/logout");
    expect(logout.searchParams.get("id_token_hint")).toBe(tokens.id_token);
    expect(logout.searchParams.get("post_logout_redirect_uri")).toBe(
      "https://app.example.com/bye",
    );

    expect(stub.counters.discovery).toBeGreaterThanOrEqual(1);
    expect(stub.counters.token).toBe(2); // exchange + refresh
    expect(stub.counters.userinfo).toBe(1);
  });

  it("returns tokens, claims and user from handleCallback", async () => {
    const { stub, client } = await newClient();
    const flow = await client.startAuthFlow({ redirectUri: REDIRECT_URI });
    stub.state.idTokenClaims = { nonce: flow.nonce };

    const result = await client.handleCallback("auth-code-2", {
      verifier: flow.verifier,
      redirectUri: REDIRECT_URI,
      nonce: flow.nonce,
    });

    expect(result.tokens.access_token).toBeDefined();
    expect(result.claims.sub).toBe("user-1");
    expect(result.user.email).toBe("user@example.com");
  });

  it("sends the code verifier to the token endpoint", async () => {
    const { stub, client } = await newClient();
    await client.exchangeCode("auth-code-3", {
      verifier: "verifier-value",
      redirectUri: REDIRECT_URI,
    });

    const request = stub.lastTokenRequest();
    expect(request?.body?.get("code")).toBe("auth-code-3");
    expect(request?.body?.get("code_verifier")).toBe("verifier-value");
    expect(request?.body?.get("grant_type")).toBe("authorization_code");
  });
});

describe("token endpoint client authentication", () => {
  it("sends client_secret in the body with client_secret_post", async () => {
    const { stub, client } = await newClient({
      clientSecret: "post-secret",
      tokenEndpointAuthMethod: "client_secret_post",
    });
    await client.refreshToken("refresh-token-1");
    const request = stub.lastTokenRequest();
    expect(request?.body?.get("client_secret")).toBe("post-secret");
    expect(request?.authorization).toBeUndefined();
  });

  it("sends an Authorization header with client_secret_basic", async () => {
    const { stub, client } = await newClient({
      clientSecret: "basic-secret",
      tokenEndpointAuthMethod: "client_secret_basic",
    });
    await client.refreshToken("refresh-token-1");
    const request = stub.lastTokenRequest();
    expect(request?.body?.has("client_secret")).toBe(false);

    const expected = btoa("test-client:basic-secret");
    expect(request?.authorization).toBe(`Basic ${expected}`);
  });

  it("throws a REFRESH_FAILED on a rejected refresh grant", async () => {
    const { stub, client } = await newClient();
    stub.state.failToken = true;
    await expect(client.refreshToken("refresh-token-1")).rejects.toMatchObject({
      code: "refresh_failed",
    });
  });
});

describe("logout", () => {
  it("errors when the provider does not advertise an end_session_endpoint", async () => {
    const { stub, client } = await newClient();
    stub.state.discovery = { end_session_endpoint: undefined };
    await expect(
      client.buildEndSessionUrl({ idToken: "id-token" }),
    ).rejects.toMatchObject({ code: "logout_not_supported" });
  });
});
