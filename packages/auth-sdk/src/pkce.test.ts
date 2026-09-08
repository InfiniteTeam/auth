import { describe, expect, it } from "vitest";
import { OidcClient } from "./client.js";
import { OIDC_ERROR_CODES } from "./errors.js";
import { toBase64Url } from "./utils.js";

describe("OidcClient.createPkcePair", () => {
  it("derives an S256 challenge from the verifier", async () => {
    const pair = await OidcClient.createPkcePair();
    expect(pair.verifier.length).toBeGreaterThanOrEqual(43);
    expect(pair.verifier.length).toBeLessThanOrEqual(128);
    expect(pair.verifier).toMatch(/^[A-Za-z0-9_-]+$/);

    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(pair.verifier),
    );
    expect(toBase64Url(digest)).toBe(pair.challenge);
  });

  it("produces unique verifiers", async () => {
    const a = await OidcClient.createPkcePair();
    const b = await OidcClient.createPkcePair();
    expect(a.verifier).not.toBe(b.verifier);
    expect(a.challenge).not.toBe(b.challenge);
  });
});

describe("OidcClient construction", () => {
  it("requires issuerUrl", () => {
    expect(() => new OidcClient({ issuerUrl: "", clientId: "c" })).toThrowError(
      expect.objectContaining({ code: OIDC_ERROR_CODES.MISSING_OPTION }),
    );
  });

  it("requires clientId", () => {
    expect(
      () => new OidcClient({ issuerUrl: "https://auth.inft.kr", clientId: "" }),
    ).toThrowError(
      expect.objectContaining({ code: OIDC_ERROR_CODES.MISSING_OPTION }),
    );
  });

  it("requires clientSecret for client_secret_basic", () => {
    expect(
      () =>
        new OidcClient({
          issuerUrl: "https://auth.inft.kr",
          clientId: "c",
          tokenEndpointAuthMethod: "client_secret_basic",
        }),
    ).toThrowError(
      expect.objectContaining({ code: OIDC_ERROR_CODES.MISSING_OPTION }),
    );
  });
});
