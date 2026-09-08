import { afterEach, describe, expect, it } from "vitest";
import { OidcClient } from "./client.js";
import { OIDC_ERROR_CODES } from "./errors.js";
import { createOidcStub, type OidcStub } from "./test-support.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const stubs: OidcStub[] = [];

afterEach(async () => {
  await Promise.all(stubs.splice(0).map((s) => s.stop()));
});

describe("discovery", () => {
  it("fetches and caches the discovery document within the TTL", async () => {
    const stub = await (async () => {
      const s = await createOidcStub();
      stubs.push(s);
      return s;
    })();
    const client = new OidcClient({
      issuerUrl: stub.baseUrl,
      clientId: "test-client",
      discoveryCacheTtlMs: 200,
    });

    const first = await client.discovery();
    expect(first.issuer).toBe(stub.baseUrl);
    expect(stub.counters.discovery).toBe(1);

    await client.discovery();
    expect(stub.counters.discovery).toBe(1);

    await sleep(250);
    await client.discovery();
    expect(stub.counters.discovery).toBe(2);
  });

  it("reports non-2xx discovery responses as OidcError", async () => {
    const stub = await createOidcStub();
    stubs.push(stub);
    const client = new OidcClient({
      issuerUrl: `http://127.0.0.1:1`, // nothing listens here
      clientId: "test-client",
      requestTimeoutMs: 500,
    });
    await expect(client.discovery()).rejects.toThrowError(
      expect.objectContaining({ name: "OidcError" }),
    );
  });
});

describe("startAuthFlow", () => {
  it("builds a PKCE authorization URL with generated state and nonce", async () => {
    const stub = await createOidcStub();
    stubs.push(stub);
    const client = new OidcClient({
      issuerUrl: stub.baseUrl,
      clientId: "test-client",
    });

    const flow = await client.startAuthFlow({
      redirectUri: "https://app.example.com/callback",
    });

    const parsed = new URL(flow.url);
    expect(parsed.origin).toBe(stub.baseUrl);
    expect(parsed.pathname).toBe("/authorize");
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("client_id")).toBe("test-client");
    expect(parsed.searchParams.get("scope")).toBe("openid profile email");
    expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
    expect(parsed.searchParams.get("state")).toBe(flow.state);
    expect(parsed.searchParams.get("nonce")).toBe(flow.nonce);
    expect(parsed.searchParams.has("code_challenge")).toBe(true);
    expect(parsed.searchParams.get("redirect_uri")).toBe(
      "https://app.example.com/callback",
    );
  });

  it("requires a redirectUri", async () => {
    const stub = await createOidcStub();
    stubs.push(stub);
    const client = new OidcClient({
      issuerUrl: stub.baseUrl,
      clientId: "test-client",
    });
    await expect(
      client.startAuthFlow({ redirectUri: "" }),
    ).rejects.toThrowError(
      expect.objectContaining({ code: OIDC_ERROR_CODES.MISSING_REDIRECT_URI }),
    );
  });
});
