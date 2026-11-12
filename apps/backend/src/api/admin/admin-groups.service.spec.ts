import { describe, expect, it, vi } from "vitest";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { PermissionBitField } from "@inftkr/shared";
import { validate } from "class-validator";
import { appConfigFixture } from "../../config/app-config.fixture.js";
import { AdminGroupsService } from "./admin-groups.service.js";
import { UpdateAdminGroupDto } from "./dto/group-admin.dto.js";

function createService() {
  const lldap = {
    listGroups: vi.fn(async () => [
      { id: 1, displayName: "admins", members: ["admin"] },
      { id: 2, displayName: "editors", members: ["editor"] },
    ]),
    updateGroupAdmin: vi.fn(async () => undefined),
    addUserToGroup: vi.fn(async () => undefined),
    deleteGroupAdmin: vi.fn(async () => undefined),
  };
  const prisma = {
    groupPolicy: {
      findMany: vi.fn(async () => [{ groupId: 2, priority: 5, permissions: "24" }]),
      upsert: vi.fn(async () => undefined),
      deleteMany: vi.fn(async () => ({ count: 1 })),
    },
  };
  const service = new AdminGroupsService(appConfigFixture(), lldap as never, prisma as never);
  return { service, lldap, prisma };
}

describe("AdminGroupsService", () => {
  it("rejects null update fields before any service write", async () => {
    for (const field of ["displayName", "priority", "permissions"]) {
      const dto = Object.assign(new UpdateAdminGroupDto(), { [field]: null });
      expect((await validate(dto)).map((error) => error.property)).toContain(field);
    }
  });
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
    await service.update(2, { priority: 10, permissions: "16" }, "2047");
    expect(prisma.groupPolicy.upsert).toHaveBeenCalledWith({
      where: { groupId: 2 },
      create: { groupId: 2, priority: 10, permissions: "16" },
      update: { priority: 10, permissions: "16" },
    });
  });

  it("protects the platform admin group and rejects unknown bits", async () => {
    const { service, prisma } = createService();
    await expect(service.update(1, { permissions: "0" }, "2047")).rejects.toThrow(BadRequestException);
    await expect(service.update(2, { permissions: "2048" }, "2047")).rejects.toThrow(BadRequestException);
    await expect(service.update(2, { displayName: "admins" }, "2047")).rejects.toThrow(BadRequestException);
    expect(prisma.groupPolicy.upsert).not.toHaveBeenCalled();
  });

  it("prevents policy and membership changes that grant more than the actor holds", async () => {
    const { service, prisma, lldap } = createService();
    await expect(service.update(2, { permissions: "2047" }, "64")).rejects.toThrow(ForbiddenException);
    await expect(service.update(2, { priority: 10 }, "64")).rejects.toThrow(ForbiddenException);
    await expect(service.addMember(1, "editor", "64")).rejects.toThrow(ForbiddenException);
    await expect(service.addMember(2, "editor", "64")).rejects.toThrow(ForbiddenException);
    expect(prisma.groupPolicy.upsert).not.toHaveBeenCalled();
    expect(lldap.addUserToGroup).not.toHaveBeenCalled();
  });

  it("rejects lowering priority when it exposes stronger permissions for a member", async () => {
    const { service, prisma, lldap } = createService();
    lldap.listGroups.mockResolvedValue([
      { id: 1, displayName: "admins", members: ["admin"] },
      { id: 2, displayName: "editors", members: ["editor"] },
      { id: 3, displayName: "powerful", members: ["editor"] },
    ]);
    prisma.groupPolicy.findMany.mockResolvedValue([
      { groupId: 2, priority: 5, permissions: "64" },
      { groupId: 3, priority: 1, permissions: "1024" },
    ]);

    await expect(service.update(2, { priority: 0 }, "64")).rejects.toThrow(ForbiddenException);
    expect(prisma.groupPolicy.upsert).not.toHaveBeenCalled();
  });

  it("still allows a fully privileged admin to add platform administrators", async () => {
    const { service, lldap } = createService();
    await service.addMember(1, "editor", PermissionBitField.All.toString());
    expect(lldap.addUserToGroup).toHaveBeenCalledWith("editor", 1);
  });

  it("cleans an orphan policy when directory deletion already succeeded", async () => {
    const { service, prisma, lldap } = createService();
    lldap.listGroups.mockResolvedValue([{ id: 1, displayName: "admins", members: ["admin"] }]);
    await service.remove(2);
    expect(lldap.deleteGroupAdmin).not.toHaveBeenCalled();
    expect(prisma.groupPolicy.deleteMany).toHaveBeenCalledWith({ where: { groupId: 2 } });
  });
});
