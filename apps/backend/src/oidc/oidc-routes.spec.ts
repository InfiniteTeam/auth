/**
 * Unit tests for OIDC route helpers.
 */

import { describe, expect, it } from "vitest";
import { isOidcRoute, stripUnsupportedPrompt } from "./oidc-routes.js";

describe("isOidcRoute", () => {
  it("matches provider-owned routes and their subpaths", () => {
    expect(isOidcRoute("/auth")).toBe(true);
    expect(isOidcRoute("/token")).toBe(true);
    expect(isOidcRoute("/.well-known/openid-configuration")).toBe(true);
    expect(isOidcRoute("/interaction/abc")).toBe(true);
  });

  it("rejects unrelated paths", () => {
    expect(isOidcRoute("/api/v1/session")).toBe(false);
    expect(isOidcRoute("/login")).toBe(false);
    expect(isOidcRoute("/authentic")).toBe(false);
  });
});

describe("stripUnsupportedPrompt", () => {
  it("strips select_account while keeping supported values in order", () => {
    const out = stripUnsupportedPrompt(
      "/auth?client_id=tailscale&prompt=consent+login+select_account&scope=openid",
    );
    expect(out).toContain("prompt=consent+login");
    expect(out).not.toContain("select_account");
    expect(out).toContain("client_id=tailscale");
  });

  it("drops the parameter when only unsupported values remain", () => {
    const out = stripUnsupportedPrompt("/auth?prompt=select_account&scope=openid");
    expect(out).not.toContain("prompt=");
    expect(out).toContain("scope=openid");
  });

  it("returns supported-only and prompt-less URLs unchanged", () => {
    expect(stripUnsupportedPrompt("/auth?prompt=login&scope=openid")).toBe(
      "/auth?prompt=login&scope=openid",
    );
    expect(stripUnsupportedPrompt("/auth?prompt=none")).toBe("/auth?prompt=none");
    expect(stripUnsupportedPrompt("/auth?scope=openid")).toBe("/auth?scope=openid");
    expect(stripUnsupportedPrompt("/auth")).toBe("/auth");
  });
});
