import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminOverviewService } from "./admin-overview.service.js";

afterEach(() => vi.useRealTimers());

describe("AdminOverviewService", () => {
  it("fills empty UTC weeks and orders recent changes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-12T12:00:00Z"));
    const prisma = {
      $queryRaw: vi.fn(async () => [
        { week: new Date("2026-11-09T00:00:00Z"), count: 3n },
      ]),
      oidcClient: {
        findMany: vi.fn(async () => [
          {
            clientId: "client-1",
            createdAt: new Date("2026-11-10T00:00:00Z"),
            updatedAt: new Date("2026-11-10T00:00:00Z"),
          },
        ]),
      },
      platformSetting: {
        findMany: vi.fn(async () => [
          {
            key: "social.github",
            updatedAt: new Date("2026-11-11T00:00:00Z"),
          },
        ]),
      },
      session: { count: vi.fn(async () => 2) },
    };

    const result = await new AdminOverviewService(prisma as never).get();

    expect(result.weeks).toHaveLength(8);
    expect(result.weeks.at(-1)).toEqual({
      week: "2026-11-09T00:00:00.000Z",
      count: 3,
    });
    expect(result.weeks.slice(0, -1).every((week) => week.count === 0)).toBe(
      true,
    );
    expect(result.activeSessions).toBe(2);
    expect(result.changes.map((change) => change.label)).toEqual([
      "social.github",
      "client-1",
    ]);
  });
});
