import { describe, expect, it } from "vitest";
import {
  generateNonce,
  generateState,
  randomToken,
  toBase64Url,
} from "./utils.js";

describe("toBase64Url", () => {
  it("encodes bytes as unpadded base64url", () => {
    const input = new TextEncoder().encode("hello world");
    expect(toBase64Url(input)).toBe("aGVsbG8gd29ybGQ");
  });

  it("handles an empty input", () => {
    expect(toBase64Url(new Uint8Array(0))).toBe("");
  });
});

describe("randomToken", () => {
  it("produces url-safe strings of the requested byte size", () => {
    const token = randomToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThan(32);
  });

  it("produces unique values", () => {
    const seen = new Set(Array.from({ length: 100 }, () => randomToken()));
    expect(seen.size).toBe(100);
  });
});

describe("generateState / generateNonce", () => {
  it("returns distinct, url-safe values", () => {
    const states = new Set(Array.from({ length: 50 }, () => generateState()));
    const nonces = new Set(Array.from({ length: 50 }, () => generateNonce()));
    expect(states.size).toBe(50);
    expect(nonces.size).toBe(50);
    expect([...nonces].every((n) => /^[A-Za-z0-9_-]+$/.test(n))).toBe(true);
  });
});
