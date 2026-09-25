/**
 * Test fixture for {@link PlatformSettingsService}.
 *
 * Builds a real service over a stub Prisma `platformSetting` table so specs
 * exercise the actual override resolution (array vs comma string vs env
 * fallback) rather than a hand-rolled mock of it.
 */

import { vi } from "vitest";
import { PlatformSettingsService } from "./platform-settings.service.js";
import type { AppConfig } from "./config.js";

/**
 * Returns a {@link PlatformSettingsService} backed by an in-memory row map,
 * plus the stub Prisma it reads through. A row whose value is `null` or absent
 * means "fall back to the environment".
 */
export function platformSettingsFixture(
  config: AppConfig,
  rows: Record<string, unknown> = {},
): { service: PlatformSettingsService; prisma: { platformSetting: { findUnique: ReturnType<typeof vi.fn> } } } {
  const prisma = {
    platformSetting: {
      findUnique: vi.fn(async ({ where }: { where: { key: string } }) => {
        const value = rows[where.key];
        return value === undefined ? null : { key: where.key, value };
      }),
    },
  };
  return {
    service: new PlatformSettingsService(config, prisma as never),
    prisma,
  };
}
