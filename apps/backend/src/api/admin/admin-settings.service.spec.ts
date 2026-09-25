/**
 * Unit tests for {@link AdminSettingsService} override validation.
 *
 * The original defect: any JSON was accepted for `auth.allowedDomains`, the UI
 * reported it as `source: "override"`, and enforcement ignored it entirely.
 * Writes are now rejected when the shape could never take effect.
 */

import { describe, expect, it, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { appConfigFixture } from "../../config/app-config.fixture.js";
import { platformSettingsFixture } from "../../config/platform-settings.fixture.js";
import { AdminSettingsService } from "./admin-settings.service.js";

const config = appConfigFixture();

function createService(rows: Record<string, unknown> = {}) {
  const store = new Map<string, unknown>(Object.entries(rows));
  const prisma = {
    platformSetting: {
      findMany: vi.fn(async () =>
        [...store].map(([key, value]) => ({
          key,
          value,
          updatedAt: new Date(),
          updatedBy: "admin",
        })),
      ),
      findUnique: vi.fn(async ({ where }: { where: { key: string } }) => {
        const value = store.get(where.key);
        return value === undefined ? null : { key: where.key, value };
      }),
      upsert: vi.fn(async ({ where, create, update }: Record<string, any>) => {
        store.set(where.key, create.value);
        return { key: where.key, ...create };
      }),
      deleteMany: vi.fn(async ({ where }: { where: { key: string } }) => {
        store.delete(where.key);
        return { count: 1 };
      }),
    },
  };
  const service = new AdminSettingsService(
    config,
    platformSettingsFixture(config, rows).service,
    prisma as never,
  );
  return { service, prisma, store };
}

describe("AdminSettingsService.set allowed-domain validation", () => {
  it("accepts an array of domains", async () => {
    const { service, store } = createService();

    await service.set("auth.allowedDomains", ["team.kr"]);

    expect(store.get("auth.allowedDomains")).toEqual(["team.kr"]);
  });

  it("accepts a comma-separated string", async () => {
    const { service, store } = createService();

    await service.set("auth.allowedDomains", "a.kr, b.kr");

    expect(store.get("auth.allowedDomains")).toBe("a.kr, b.kr");
  });

  it("rejects a non-list value", async () => {
    const { service, prisma } = createService();

    await expect(service.set("auth.allowedDomains", 42)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.platformSetting.upsert).not.toHaveBeenCalled();
  });

  it("rejects an array containing an empty or non-string entry", async () => {
    const { service } = createService();

    await expect(service.set("auth.allowedDomains", ["", "team.kr"])).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.set("auth.allowedDomains", ["team.kr", 7])).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("clears the override on null, restoring the environment default", async () => {
    const { service, store } = createService({ "auth.allowedDomains": ["team.kr"] });

    const entry = await service.set("auth.allowedDomains", null);

    expect(store.has("auth.allowedDomains")).toBe(false);
    expect(entry.source).toBe("env");
    expect(entry.value).toEqual(["inft.kr"]);
  });
});

describe("AdminSettingsService.set redirect-base-URL validation", () => {
  it("accepts an http(s) URL", async () => {
    const { service, store } = createService();

    await service.set("auth.socialRedirectBaseUrl", "https://auth.example.com");

    expect(store.get("auth.socialRedirectBaseUrl")).toBe("https://auth.example.com");
  });

  it("rejects a non-http scheme", async () => {
    const { service, prisma } = createService();

    await expect(
      service.set("auth.socialRedirectBaseUrl", "javascript:alert(1)"),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.platformSetting.upsert).not.toHaveBeenCalled();
  });
});

describe("AdminSettingsService meta", () => {
  it("reports the effective values, not the raw environment ones", async () => {
    const { service } = createService({
      "auth.allowedDomains": ["team.kr"],
      "auth.socialRedirectBaseUrl": "https://auth.example.com/",
    });

    await expect(service.meta()).resolves.toMatchObject({
      allowedDomains: ["team.kr"],
      githubCallbackUrl: "https://auth.example.com/api/v1/auth/social/github/callback",
      discordCallbackUrl: "https://auth.example.com/api/v1/auth/social/discord/callback",
    });
  });
});
