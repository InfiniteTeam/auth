import { describe, expect, it, vi } from "vitest";
import { AdminSessionsService } from "./admin-sessions.service.js";

describe("AdminSessionsService.list", () => {
  it("filters active sessions before limiting the result", async () => {
    const findMany = vi.fn(async () => []);
    const service = new AdminSessionsService({
      session: { findMany },
    } as never);

    await service.list({ userId: "alice", limit: 50 });

    expect(findMany).toHaveBeenCalledWith({
      where: {
        userId: "alice",
        revokedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      orderBy: { issuedAt: "desc" },
      take: 50,
    });
  });

  it("includes inactive sessions in the full history view", async () => {
    const findMany = vi.fn(async () => []);
    const service = new AdminSessionsService({
      session: { findMany },
    } as never);

    await service.list({ activeOnly: false });

    expect(findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { issuedAt: "desc" },
      take: 50,
    });
  });
});
