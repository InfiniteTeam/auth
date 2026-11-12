import { describe, expect, it, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { PermissionBitField } from "@inftkr/shared";
import { appConfigFixture } from "../../config/app-config.fixture.js";
import { AdminGroupsService } from "./admin-groups.service.js";

function createService() {
  const lldap = {
    listGroups: vi.fn(async () => [
      { id: 1, displayName: "admins", members: ["admin"] },
      { id: 2, displayName: "editors", members: ["editor"] },
    ]),
    updateGroupAdmin: vi.fn(async () => undefined),
  };
  const prisma = {
    groupPolicy: {
      findMany: vi.fn(async () => [{ groupId: 2, priority: 5, permissions: "24" }]),
      upsert: vi.fn(async () => undefined),
    },
  };
  const service = new AdminGroupsService(appConfigFixture(), lldap as never, prisma as never);
  return { service, lldap, prisma };
}

describe("AdminGroupsService", () => {
  it("lists stored policies while preserving full platform admin permissions", async () => {
    const { service } = createService();
    await expect(service.list()).resolves.toEqual([
      { id: 1, displayName: "admins", members: ["admin"], priority: 0,
        permissions: PermissionBitField.All.toString(), isPlatformAdmin: true },
      { id: 2, displayName: "editors", members: ["editor"], priority: 5,
        permissions: "24", isPlatformAdmin: false },
    ]);
  });

  it("updates policy by stable lldap group id", async () => {
    const { service, prisma } = createService();
    await service.update(2, { priority: 10, permissions: "16" });
    expect(prisma.groupPolicy.upsert).toHaveBeenCalledWith({
      where: { groupId: 2 },
      create: { groupId: 2, priority: 10, permissions: "16" },
      update: { priority: 10, permissions: "16" },
    });
  });

  it("protects the platform admin group and rejects unknown bits", async () => {
    const { service, prisma } = createService();
    await expect(service.update(1, { permissions: "0" })).rejects.toThrow(BadRequestException);
    await expect(service.update(2, { permissions: "2048" })).rejects.toThrow(BadRequestException);
    await expect(service.update(2, { displayName: "admins" })).rejects.toThrow(BadRequestException);
    expect(prisma.groupPolicy.upsert).not.toHaveBeenCalled();
  });
});
