/**
 * Prisma-backed adapter for oidc-provider.
 *
 * oidc-provider is storage-agnostic: it asks an `Adapter` to persist and load
 * its runtime models (AccessToken, RefreshToken, AuthorizationCode, Grant,
 * Interaction, Session, etc.) and its registered `Client` records. This
 * adapter stores that state in the Prisma `auth` database — runtime models in
 * the `OidcModel` table, and client registrations in the `OidcClient` table.
 */

import type { Adapter, AdapterFactory, AdapterPayload } from "oidc-provider";
import type { PrismaClient } from "../generated/prisma/client.js";

/** Model names that oidc-provider persists via the adapter. */
const MODEL_NAMES = [
  "Session",
  "AccessToken",
  "AuthorizationCode",
  "RefreshToken",
  "DeviceCode",
  "ClientCredentials",
  "BackchannelAuthenticationRequest",
  "PushedAuthorizationRequest",
  "Grant",
  "Interaction",
  "UserCode",
];

export class PrismaAdapter implements Adapter {
  /**
   * Creates an adapter factory bound to a {@link PrismaClient}.
   *
   * @param prisma - The shared Prisma client.
   * @param modelName - The name of the adapter as invoked by oidc-provider.
   */
  constructor(
    private readonly prisma: PrismaClient,
    private readonly modelName: string,
  ) {}

  /** @inheritDoc */
  async upsert(
    id: string,
    payload: AdapterPayload,
    expiresIn?: number,
  ): Promise<void> {
    const expiresAt =
      typeof expiresIn === "number" && isFinite(expiresIn)
        ? new Date(Date.now() + expiresIn * 1000)
        : null;
    const data = {
      payload: payload as object,
      expiresAt,
      grantId:
        typeof payload.grantId === "string" && payload.grantId
          ? payload.grantId
          : null,
    };

    if (this.modelName === "Client") {
      await this.prisma.oidcClient.upsert({
        where: { clientId: id },
        create: {
          clientId: id,
          clientSecret:
            typeof payload.client_secret === "string"
              ? payload.client_secret
              : null,
          grantTypes: this.strList(payload.grant_types),
          responseTypes: this.strList(payload.response_types),
          redirectUris: this.strList(payload.redirect_uris),
          scopes: this.strList(payload.scope),
          metadata: payload as object,
        },
        update: {
          clientSecret:
            typeof payload.client_secret === "string"
              ? payload.client_secret
              : null,
          grantTypes: this.strList(payload.grant_types),
          responseTypes: this.strList(payload.response_types),
          redirectUris: this.strList(payload.redirect_uris),
          scopes: this.strList(payload.scope),
          metadata: payload as object,
        },
      });
      return;
    }

    await this.prisma.oidcModel.upsert({
      where: { model_id: { model: this.modelName, id } },
      create: { model: this.modelName, id, ...data },
      update: data,
    });
  }

  /** @inheritDoc */
  async find(id: string): Promise<AdapterPayload | undefined> {
    if (this.modelName === "Client") {
      const row = await this.prisma.oidcClient.findUnique({
        where: { clientId: id },
      });
      return row ? (row.metadata as AdapterPayload) : undefined;
    }
    const row = await this.prisma.oidcModel.findUnique({
      where: { model_id: { model: this.modelName, id } },
    });
    return row
      ? this.expirable(row.payload as AdapterPayload, row.expiresAt)
      : undefined;
  }

  /** @inheritDoc */
  async findByUid(uid: string): Promise<AdapterPayload | undefined> {
    const row = await this.prisma.oidcModel.findFirst({
      where: { model: this.modelName, payload: { path: ["uid"], equals: uid } },
    });
    return row ? (row.payload as AdapterPayload) : undefined;
  }

  /** @inheritDoc */
  async findByUserCode(userCode: string): Promise<AdapterPayload | undefined> {
    const row = await this.prisma.oidcModel.findFirst({
      where: {
        model: this.modelName,
        payload: { path: ["userCode"], equals: userCode },
      },
    });
    return row ? (row.payload as AdapterPayload) : undefined;
  }

  /** @inheritDoc */
  async consume(id: string): Promise<void> {
    await this.prisma.oidcModel.updateMany({
      where: { model: this.modelName, id },
      data: {
        payload: { ...(await this.#payload(id)), consumed: true } as object,
      },
    });
  }

  /** @inheritDoc */
  async destroy(id: string): Promise<void> {
    if (this.modelName === "Client") {
      await this.prisma.oidcClient.deleteMany({ where: { clientId: id } });
      return;
    }
    await this.prisma.oidcModel.deleteMany({
      where: { model: this.modelName, id },
    });
  }

  /** @inheritDoc */
  async revokeByGrantId(grantId: string): Promise<void> {
    await this.prisma.oidcModel.deleteMany({
      where: { model: this.modelName, grantId },
    });
  }

  async #payload(id: string): Promise<AdapterPayload> {
    const row = await this.prisma.oidcModel.findUnique({
      where: { model_id: { model: this.modelName, id } },
    });
    return (row?.payload as AdapterPayload) ?? {};
  }

  private expirable(
    payload: AdapterPayload,
    expiresAt: Date | null,
  ): AdapterPayload {
    if (expiresAt === null) {
      return payload;
    }
    const seconds = Math.round((expiresAt.getTime() - Date.now()) / 1000);
    return seconds > 0
      ? {
          ...payload,
          ...(this.modelName === "Session"
            ? {}
            : { exp: Math.floor(expiresAt.getTime() / 1000) }),
        }
      : payload;
  }

  private strList(value: unknown): string[] {
    if (typeof value === "string") {
      return value.split(" ").filter(Boolean);
    }
    if (Array.isArray(value)) {
      return value.filter((v): v is string => typeof v === "string");
    }
    return [];
  }
}

/**
 * Builds an oidc-provider `adapter` option from a shared {@link PrismaClient}.
 */
export function createPrismaAdapterFactory(
  prisma: PrismaClient,
): AdapterFactory {
  return (name: string) => new PrismaAdapter(prisma, name);
}

/**
 * The list of runtime model names oidc-provider may persist. Kept for
 * documentation and potential cleanup tasks.
 */
export { MODEL_NAMES };
