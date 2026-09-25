/**
 * Unit tests for {@link PlatformSettingsService} — the layer that makes admin
 * overrides effective.
 *
 * The bug this guards against: `auth.allowedDomains` was registered and
 * displayed in the admin UI but never read by enforcement code, so saving an
 * override changed nothing. Every resolver here must therefore prove that a
 * stored row actually changes the result.
 */

import { describe, expect, it } from "vitest";
import { appConfigFixture } from "./app-config.fixture.js";
import { PlatformSettingsService } from "./platform-settings.service.js";

const config = appConfigFixture();

function createService(rows: Record<string, unknown> = {}) {
  const values = new Map<string, unknown>(Object.entries(rows));
  const prisma = {
    platformSetting: {
      findUnique: async ({ where }: { where: { key: string } }) => {
        const value = values.get(where.key);
        return value === undefined ? null : { key: where.key, value };
      },
    },
  };
  return new PlatformSettingsService(config, prisma as never);
}

describe("PlatformSettingsService.getAllowedDomains", () => {
  it("falls back to the environment when no override exists", async () => {
    await expect(createService().getAllowedDomains()).resolves.toEqual(["inft.kr"]);
  });

  it("falls back to the environment for an explicit null row", async () => {
    await expect(
      createService({ "auth.allowedDomains": null }).getAllowedDomains(),
    ).resolves.toEqual(["inft.kr"]);
  });

  it("applies a stored array override", async () => {
    await expect(
      createService({ "auth.allowedDomains": ["team.kr", "other.kr"] }).getAllowedDomains(),
    ).resolves.toEqual(["team.kr", "other.kr"]);
  });

  it("accepts a comma-separated string, matching the env var format", async () => {
    await expect(
      createService({ "auth.allowedDomains": "team.kr, other.kr" }).getAllowedDomains(),
    ).resolves.toEqual(["team.kr", "other.kr"]);
  });

  it("normalizes case, whitespace, duplicates and non-string entries", async () => {
    await expect(
      createService({
        "auth.allowedDomains": [" Team.KR ", "team.kr", "", 42, null],
      }).getAllowedDomains(),
    ).resolves.toEqual(["team.kr"]);
  });

  it("honours an empty override as an explicit disable, not as unset", async () => {
    await expect(
      createService({ "auth.allowedDomains": [] }).getAllowedDomains(),
    ).resolves.toEqual([]);
  });

  it("ignores an override of an unusable type", async () => {
    await expect(
      createService({ "auth.allowedDomains": 12345 }).getAllowedDomains(),
    ).resolves.toEqual(["inft.kr"]);
  });
});

describe("PlatformSettingsService.getSocialRedirectBaseUrl", () => {
  it("falls back to the environment when no override exists", async () => {
    await expect(createService().getSocialRedirectBaseUrl()).resolves.toBe(
      "http://localhost:3000",
    );
  });

  it("applies a stored http(s) override", async () => {
    await expect(
      createService({
        "auth.socialRedirectBaseUrl": "https://auth.example.com",
      }).getSocialRedirectBaseUrl(),
    ).resolves.toBe("https://auth.example.com");
  });

  it("ignores a non-http override rather than breaking every redirect", async () => {
    await expect(
      createService({ "auth.socialRedirectBaseUrl": "javascript:alert(1)" })
        .getSocialRedirectBaseUrl(),
    ).resolves.toBe("http://localhost:3000");
  });

  it("strips a trailing slash when exposing the origin", async () => {
    await expect(
      createService({
        "auth.socialRedirectBaseUrl": "https://auth.example.com/",
      }).getSocialRedirectOrigin(),
    ).resolves.toBe("https://auth.example.com");
  });
});
