/**
 * Unit tests for OAuthStateService cookie minting/verification.
 */

import { describe, expect, it, vi } from "vitest";
import { appConfigFixture } from "../config/app-config.fixture.js";
import { OAuthStateService } from "./oauth-state.service.js";

const config = appConfigFixture();

function createService(overrides: Record<string, unknown> = {}) {
  const service = new OAuthStateService({
    ...config,
    ...overrides,
  });
  return service;
}

describe("OAuthStateService", () => {
  it("mints a state packet with a signed cookie value", () => {
    const service = createService();
    const created = service.create("github", false);
    expect(created.state).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(created.codeVerifier).toBeUndefined();
    expect(created.cookieValue).toMatch(/^[A-Za-z0-9_-]+\.[0-9a-f]{64}$/);
  });

  it("embeds a PKCE code verifier only when requested", () => {
    const service = createService();
    const created = service.create("discord", true);
    expect(created.codeVerifier).toMatch(/^[A-Za-z0-9_-]{64}$/);
    const payload = JSON.parse(
      Buffer.from(created.cookieValue.split(".")[0]!, "base64url").toString(
        "utf8",
      ),
    );
    expect(payload.codeVerifier).toBe(created.codeVerifier);
    expect(payload.provider).toBe("discord");
  });

  it("verifies a valid state round trip", () => {
    const service = createService();
    const created = service.create("github", false);
    const payload = service.verify(created.cookieValue, created.state);
    expect(payload).not.toBeNull();
    expect(payload?.provider).toBe("github");
    expect(payload?.state).toBe(created.state);
  });

  it("rejects a state that does not match the cookie payload", () => {
    const service = createService();
    const created = service.create("github", false);
    expect(service.verify(created.cookieValue, "attacker-state")).toBeNull();
  });

  it("rejects tampered and unsigned cookies", () => {
    const service = createService();
    const created = service.create("github", false);
    const [encoded] = created.cookieValue.split(".");
    expect(service.verify(`${encoded}.beef`, created.state)).toBeNull();
    expect(service.verify(encoded, created.state)).toBeNull();
    expect(service.verify("junk.value", created.state)).toBeNull();
    expect(service.verify(undefined, created.state)).toBeNull();
    expect(service.verify(null, created.state)).toBeNull();
  });

  it("rejects an expired state packet", () => {
    vi.useFakeTimers();
    try {
      const service = createService();
      const base = Date.now();
      vi.setSystemTime(base);
      const created = service.create("github", false);
      vi.setSystemTime(base + config.oauthStateTtlMs + 1);
      expect(service.verify(created.cookieValue, created.state)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects a packet whose issue time lies in the future", () => {
    vi.useFakeTimers();
    try {
      const service = createService();
      const base = Date.now();
      vi.setSystemTime(base);
      const created = service.create("github", false);
      vi.setSystemTime(base - 1000);
      expect(service.verify(created.cookieValue, created.state)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("derives cookie options from the config", () => {
    const service = createService({ nodeEnv: "development" });
    expect(service.cookieOptions).toMatchObject({
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
    const prodService = createService({ nodeEnv: "production" });
    expect(prodService.cookieOptions.secure).toBe(true);
  });
});