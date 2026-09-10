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
  it('resolves the platform domain when "resource" is omitted', () => {
    const result = controller.getWebFinger();
    expect(result.subject).toBe("acct:user@inft.kr");
    expect(result.links[0]?.rel).toBe(
      "http://openid.net/specs/connect/1.0/issuer",
    );
    expect(result.links[0]?.href).toBe("http://localhost:3000");
  });

  it("echoes a valid acct resource for the platform domain", () => {
    const result = controller.getWebFinger("acct:someone@inft.kr");
    expect(result.subject).toBe("acct:someone@inft.kr");
    expect(result.links[0]?.href).toBe("http://localhost:3000");
  });

  it("accepts a bare acct URI for the platform domain", () => {
    const result = controller.getWebFinger("acct:inft.kr");
    expect(result.subject).toBe("acct:inft.kr");
  });

  it.each([
    "acct:someone@evil.example",
    "acct:someone@sub.inft.kr",
    "acct:someone@evil.example@inft.kr",
    "https://evil.example/",
    "mailto:someone@inft.kr",
    "acct:inft.kr/sub",
    "acct: someone@inft.kr",
  ])("rejects foreign or malformed resource %s", (resource) => {
    expect(() => controller.getWebFinger(resource)).toThrow(
      BadRequestException,
    );
  });

  it("serves descriptors with no-cache and nosniff headers", () => {
    const headers: Array<{ name: string; value: string }> =
      Reflect.getMetadata("__headers__", WebFingerController.prototype.getWebFinger);
    expect(Object.fromEntries(headers.map((h) => [h.name, h.value]))).toEqual({
      "Cache-Control": "no-store, max-age=0",
      "Content-Type": "application/jrd+json",
      "X-Content-Type-Options": "nosniff",
    });
  });
});