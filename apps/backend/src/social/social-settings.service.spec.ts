/**
 * Unit tests for SocialSettingsService env/PlatformSetting resolution.
 */

import { describe, expect, it, vi } from "vitest";
import { appConfigFixture } from "../config/app-config.fixture.js";
import { platformSettingsFixture } from "../config/platform-settings.fixture.js";
import { SocialConfigurationError } from "./social.types.js";
import { SocialSettingsService } from "./social-settings.service.js";

function createHarness(
  overrides: Record<string, unknown> = {},
  rows: Record<string, unknown> = {},
) {
  const config = { ...appConfigFixture(), ...overrides };
  const { service, prisma } = platformSettingsFixture(config, rows);
  return { service: new SocialSettingsService(config, service), prisma };
}

describe("SocialSettingsService.getProviderOauth", () => {
  it("falls back to the environment credentials", async () => {
    const { service } = createHarness();
    await expect(service.getProviderOauth("github")).resolves.toEqual({
      clientId: "github-client-id",
      clientSecret: "github-client-secret",
    });
    await expect(service.getProviderOauth("discord")).resolves.toEqual({
      clientId: "discord-client-id",
      clientSecret: "discord-client-secret",
    });
  });

  it("lets a PlatformSetting row override the environment", async () => {
    const { service, prisma } = createHarness(
      {},
      { "social.github.clientId": "override-id" },
    );
    await expect(service.getProviderOauth("github")).resolves.toEqual({
      clientId: "override-id",
      clientSecret: "github-client-secret",
    });
    expect(prisma.platformSetting.findUnique).toHaveBeenCalledWith({
      where: { key: "social.github.clientId" },
    });
  });

  it("throws when neither the environment nor rows configure the provider", async () => {
    const { service } = createHarness({
      githubClientId: undefined,
      githubClientSecret: undefined,
    });
    await expect(service.getProviderOauth("github")).rejects.toBeInstanceOf(
      SocialConfigurationError,
    );
  });
});

describe("SocialSettingsService.isEnabled", () => {
  it("is enabled when only the environment is configured", async () => {
    const { service } = createHarness();
    await expect(service.isEnabled("github")).resolves.toBe(true);
  });

  it("is disabled when a PlatformSetting row forces it off", async () => {
    const { service } = createHarness(
      {},
      { "social.github.enabled": false },
    );
    await expect(service.isEnabled("github")).resolves.toBe(false);
  });

  it("is disabled when only a partial provider is configured", async () => {
    const { service } = createHarness({
      githubClientId: undefined,
      githubClientSecret: undefined,
    });
    await expect(service.isEnabled("github")).resolves.toBe(false);
  });
});

describe("SocialSettingsService gates", () => {
  it("resolves the GitHub org gate from the environment", async () => {
    const { service } = createHarness();
    await expect(service.getGithubGate()).resolves.toEqual({
      org: "InfiniteTeam",
    });
  });

  it("resolves the Discord guild gate from the environment", async () => {
    const { service } = createHarness();
    await expect(service.getDiscordGate()).resolves.toEqual({
      guildId: "guild-id",
      roleIds: ["role-id"],
    });
  });
});