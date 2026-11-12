import { describe, expect, it, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { AdminUsersService } from "./admin-users.service.js";
import { LldapWriteError } from "../../lldap/lldap.service.js";

function setup() {
  const lldap = {
    createUser: vi.fn(async () => undefined),
    setPasswordAsAdmin: vi.fn(async () => undefined),
    deleteUserAdmin: vi.fn(async () => undefined),
    listUsers: vi.fn(async () => [
      {
        id: "a@example.com",
        email: "a@example.com",
        displayName: "A",
        groups: [],
      },
    ]),
  };
  const prisma = {
    session: { updateMany: vi.fn(async () => ({ count: 1 })) },
    account: { deleteMany: vi.fn(async () => ({ count: 1 })) },
  };
  return {
    service: new AdminUsersService(lldap as never, prisma as never),
    lldap,
    prisma,
  };
}

describe("AdminUsersService", () => {
  it("creates a user with an initial password", async () => {
    const { service, lldap } = setup();
    await expect(
      service.create({
        email: "a@example.com",
        displayName: "A",
        password: "password123",
      }),
    ).resolves.toMatchObject({ id: "a@example.com" });
    expect(lldap.createUser).toHaveBeenCalledWith({
      uid: "a@example.com",
      email: "a@example.com",
      displayName: "A",
    });
    expect(lldap.setPasswordAsAdmin).toHaveBeenCalledWith(
      "a@example.com",
      "password123",
    );
  });

  it("removes a newly created user if password setup fails", async () => {
    const { service, lldap } = setup();
    lldap.setPasswordAsAdmin.mockRejectedValueOnce(
      new LldapWriteError("Password reset failed"),
    );
    await expect(
      service.create({
        email: "a@example.com",
        displayName: "A",
        password: "password123",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(lldap.deleteUserAdmin).toHaveBeenCalledWith("a@example.com");
  });

  it("revokes sessions and removes social links before deleting the directory user", async () => {
    const { service, lldap, prisma } = setup();
    await service.remove("a@example.com");
    expect(prisma.session.updateMany).toHaveBeenCalledWith({
      where: { userId: "a@example.com", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prisma.account.deleteMany).toHaveBeenCalledWith({
      where: { userId: "a@example.com" },
    });
    expect(lldap.deleteUserAdmin).toHaveBeenCalledWith("a@example.com");
  });
});
