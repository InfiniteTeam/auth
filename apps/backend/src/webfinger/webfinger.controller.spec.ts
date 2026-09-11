/**
 * Unit tests for the WebFinger (RFC 7033) controller.
 */

import "reflect-metadata";
import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { WebFingerController } from "./webfinger.controller.js";
import { appConfigFixture } from "../config/app-config.fixture.js";

const controller = new WebFingerController(appConfigFixture());

describe("WebFingerController", () => {
  it("echoes a valid acct resource for the platform domain", () => {
    const result = controller.getWebFinger("acct:someone@inft.kr");
    expect(result.subject).toBe("acct:someone@inft.kr");
    expect(result.links[0]?.href).toBe("http://localhost:3000");
  });

  it("rejects an absent resource (RFC 7033 §4.2 requires 400)", () => {
    expect(() => controller.getWebFinger(undefined)).toThrow(
      BadRequestException,
    );
  });

  it("rejects a repeated resource parameter (must appear exactly once)", () => {
    expect(() =>
      controller.getWebFinger(["acct:a@inft.kr", "acct:b@inft.kr"] as never),
    ).toThrow(BadRequestException);
  });

  it.each([
    "acct:someone@evil.example",
    "acct:someone@sub.inft.kr",
    "acct:someone@evil.example@inft.kr",
    "acct:inft.kr",
    "https://evil.example/",
    "mailto:someone@inft.kr",
    "acct:inft.kr/sub",
    "acct: someone@inft.kr",
  ])("rejects foreign or malformed resource %s", (resource) => {
    expect(() => controller.getWebFinger(resource)).toThrow(
      BadRequestException,
    );
  });

  it("returns the issuer link when rel selects it (RFC 7033 §3.1)", () => {
    const result = controller.getWebFinger(
      "acct:someone@inft.kr",
      "http://openid.net/specs/connect/1.0/issuer",
    );
    expect(result.subject).toBe("acct:someone@inft.kr");
    expect(result.links).toHaveLength(1);
    expect(result.links[0]?.rel).toBe(
      "http://openid.net/specs/connect/1.0/issuer",
    );
  });

  it("returns empty links for unknown rel while keeping the subject", () => {
    const result = controller.getWebFinger(
      "acct:someone@inft.kr",
      "http://example.com/rel/unknown",
    );
    expect(result.subject).toBe("acct:someone@inft.kr");
    expect(result.links).toEqual([]);
  });

  it("supports repeated rel parameters", () => {
    const result = controller.getWebFinger("acct:someone@inft.kr", [
      "http://example.com/rel/unknown",
      "http://openid.net/specs/connect/1.0/issuer",
    ]);
    expect(result.links).toHaveLength(1);
  });

  it("serves descriptors with JRD, CORS, no-cache and nosniff headers", () => {
    const headers: Array<{ name: string; value: string }> = Reflect.getMetadata(
      "__headers__",
      WebFingerController.prototype.getWebFinger,
    );
    expect(Object.fromEntries(headers.map((h) => [h.name, h.value]))).toEqual({
      "Cache-Control": "no-store, max-age=0",
      "Content-Type": "application/jrd+json",
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options": "nosniff",
    });
  });
});
